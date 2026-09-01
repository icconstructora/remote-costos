"""
gen_contracts_api.py  – Genera contracts_data.js desde API Sinco
================================================================
Tablas usadas:
  adp_dtm_dim_proyecto               → nombres y proyecto de cada sub-proyecto
  adp_dtm_dim_especificaciondecontratos → datos del contrato (fechas, nopago)
  adp_dtm_dim_especificaciondeactas   → contar actas por contrato
  adp_dtm_fact_acta                   → acumulado (suma actas) por contrato
  adp_dtm_dim_tercero                 → nombre del contratista

Salida: Liquidacion contratos/contracts_data.js  (misma ubicación que antes)
"""
import sys, os, json, time, datetime, math
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

try:
    import msal, requests
except ImportError:
    os.system(f'{sys.executable} -m pip install msal requests -q')
    import msal, requests

# ── Config ────────────────────────────────────────────────────────────────────
CLIENT_ID = '1da0f9dd-cc35-489c-937b-c66387864730'
TENANT_ID = '129cb8aa-2444-49b4-acc9-3f6a696f1ff0'
SCOPE     = ['api://1da0f9dd-cc35-489c-937b-c66387864730/access_as_user']
API_BASE  = 'https://api.icconstructora.co/api/sinco/data'

BASE     = os.path.dirname(os.path.abspath(__file__))
_out_dir = os.environ.get('OUTPUT_DIR') or os.path.join(BASE, '..', 'control-costos', 'public', 'data')
DEST     = os.path.join(_out_dir, 'contracts_data.json')
CACHE_F  = os.path.join(BASE, 'token_cache.json')

MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
              'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

# Macros conocidas — prefijo esperado en 'Nombre Proyecto' para cada key
MACRO_PREFIXES = {
    'praia':    ['PRAIA NATURA', 'PRAIA DIR'],
    'oporto':   'RESERVA DE OPORTO',
    'primera':  'PRIMERA ESTE',
    'hacienda': 'LA HACIENDA JAMUNDI',
    'bosque':   'BOSQUE CENTRAL',
    'cast-l':   'CASTILLA LIVING',
    'gaia':     'GAIA',
    'azul-t':   'AZUL TURQUESA',
    'azul-c':   'AZUL CELESTE',
    'verde':    'VERDE VIVO',
    'mitika':   'MITIKA',
    'well':     'WELL',
    'cast-i':   'CASTILLA IMPERIAL',
}

# ── Auth ──────────────────────────────────────────────────────────────────────
def get_token():
    user = os.environ.get('SINCO_USER')
    pwd  = os.environ.get('SINCO_PASS')
    if user and pwd:
        app = msal.PublicClientApplication(CLIENT_ID, authority=f'https://login.microsoftonline.com/{TENANT_ID}')
        result = app.acquire_token_by_username_password(username=user, password=pwd, scopes=SCOPE)
        if 'access_token' not in result:
            raise RuntimeError(f'Login ROPC fallido: {result.get("error_description", result)}')
        return result['access_token']
    cache = msal.SerializableTokenCache()
    if os.path.exists(CACHE_F):
        cache.deserialize(open(CACHE_F, encoding='utf-8').read())
    app = msal.PublicClientApplication(
        CLIENT_ID,
        authority=f'https://login.microsoftonline.com/{TENANT_ID}',
        token_cache=cache,
    )
    accounts = app.get_accounts()
    result = app.acquire_token_silent(SCOPE, account=accounts[0]) if accounts else None
    if not result:
        flow = app.initiate_device_flow(scopes=SCOPE)
        print(f'\n  Abre: {flow["verification_uri"]}')
        print(f'  Código: {flow["user_code"]}\n')
        result = app.acquire_token_by_device_flow(flow)
    if 'access_token' not in result:
        raise RuntimeError(f'No se pudo obtener token: {result.get("error_description", result)}')
    if cache.has_state_changed:
        open(CACHE_F, 'w', encoding='utf-8').write(cache.serialize())
    return result['access_token']

# ── API ───────────────────────────────────────────────────────────────────────
def api_get(token, tabla, params=None, intentos=3):
    url = f'{API_BASE}/{tabla}'
    headers = {'Authorization': f'Bearer {token}'}
    p = params or {}
    print(f'  GET {tabla} {p if p else ""}...', flush=True)
    t0 = time.time()
    for intento in range(1, intentos + 1):
        try:
            r = requests.get(url, headers=headers, params=p, timeout=600, stream=True)
            if not r.ok:
                print(f'    HTTP {r.status_code} (intento {intento})')
                if intento < intentos:
                    time.sleep(5)
                continue
            chunks = []
            for chunk in r.iter_content(chunk_size=512 * 1024):
                if chunk:
                    chunks.append(chunk)
            data = json.loads(b''.join(chunks))
            rows = data if isinstance(data, list) else []
            print(f'    {len(rows):,} filas  ({time.time()-t0:.1f}s)', flush=True)
            return rows
        except Exception as e:
            print(f'    ERROR intento {intento}: {e}')
            if intento < intentos:
                time.sleep(5)
    return []

# ── Helpers ───────────────────────────────────────────────────────────────────
def corte_hoy():
    h = datetime.date.today()
    return f'{h.day} {MESES[h.month]} {h.year}'

def parse_fecha(s):
    if not s:
        return None
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%Y%m%d'):
        try:
            return datetime.datetime.strptime(str(s)[:10], fmt).date()
        except ValueError:
            continue
    return None

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print('=' * 60)
    print('  IC CONSTRUCTORA - gen_contracts_api.py')
    print('  Fuente: API datamart Sinco')
    print('=' * 60)

    token = get_token()
    print('Token OK\n')

    hoy = datetime.date.today()

    # ── 1. Proyectos DIR → mapeo project_code → nombre + macro ───────────────
    print('[1/5] Proyectos DIR...')
    proy_rows = api_get(token, 'adp_dtm_dim_proyecto', {'skidempresa': 100})

    # Palabras que identifican proyectos no-directos (costos indirectos, nómina, posventa, etc.)
    EXCLUIR = (' IND ', ' NOMINA ', ' NOMINA', ' IC ', ' POSVENTA', ' SUBETAPA ')

    # project_code (int) → {nombre, macro_key}
    code_to_proy = {}
    for r in proy_rows:
        skid = r.get('skidproyecto', 0)
        code = skid - 100000
        nombre = ' '.join((r.get('Nombre Proyecto') or '').split())
        nombre_up = (' ' + nombre + ' ').upper()
        # Incluir si tiene DIR, o si no tiene ninguna de las palabras de exclusión
        tiene_dir = ' DIR ' in nombre_up
        es_indirecto = any(ex in nombre_up for ex in EXCLUIR)
        if not tiene_dir and es_indirecto:
            continue
        macro_key = None
        for key, prefix in MACRO_PREFIXES.items():
            prefixes = prefix if isinstance(prefix, list) else [prefix]
            if any(nombre.upper().startswith(p.upper()) for p in prefixes):
                macro_key = key
                break
        if macro_key:
            code_to_proy[code] = {'nombre': nombre, 'macro': macro_key}

    valid_codes = set(code_to_proy.keys())
    print(f'  {len(valid_codes)} sub-proyectos válidos\n')

    # ── 2. Especificación de contratos ────────────────────────────────────────
    print('[2/5] Especificacion contratos...')
    spec_rows = api_get(token, 'adp_dtm_dim_especificaciondecontratos')
    # Filtrar solo contratos de nuestros proyectos
    # skidcontrato → no_contrato (para cruce con fact_contrato)
    skidcontrato_to_nc = {}
    contratos = {}  # no_contrato (int) → row + extras
    for r in spec_rows:
        nc = r.get('No. Contrato')
        if not nc:
            continue
        code = int(nc) // 10000
        if code not in valid_codes:
            continue
        proy_info = code_to_proy[code]
        nc_int = int(nc)
        skidcontrato_to_nc[str(r.get('skidcontrato', ''))] = nc_int
        if nc_int not in contratos:
            contratos[nc_int] = {
                **r,
                '_proyecto': proy_info['nombre'],
                '_macro':    proy_info['macro'],
                '_actas':    0,
                '_ultima_acta':    0,
                '_acumulado':      0.0,
                '_saldoRte':       0.0,
                '_saldoAnt':       0.0,
                '_tuvoRte':        False,
                '_tuvoAnticipo':   False,
                '_skidtercero':    None,
                '_skidestado':     None,
                '_valorContrato':  0.0,
            }
    print(f'  {len(contratos):,} contratos de nuestros proyectos\n')

    # ── 3. Especificación de actas → contar + mapa skid → No Contrato ──────────
    print('[3/5] Especificacion actas...')
    actas_rows = api_get(token, 'adp_dtm_dim_especificaciondeactas')
    # mapa No Factura → set de skidespecificacionactas (para cruce con F019/F029)
    factura_to_skids = {}
    skid_to_nc = {}
    for r in actas_rows:
        nc = int(r.get('No Contrato') or 0)
        skid = r.get('skidespecificacionactas')
        nof  = r.get('No Factura', '')
        if nc in contratos:
            contratos[nc]['_actas'] += 1
        if skid:
            skid_to_nc[skid] = nc
        if nof and skid:
            factura_to_skids.setdefault(str(nof).strip(), set()).add(skid)
    print(f'  Actas contadas | {len(skid_to_nc):,} skids mapeados\n')

    # ── 3b. Con Acta SINCO y Con Acta EK ─────────────────────────────────────
    import re as _re
    print('[3b/5] Con Acta (descriptorescorrespondencia + estadofacturas)...')
    corr_rows   = api_get(token, 'sgd_dtm_correspondencia')
    estado_rows = api_get(token, 'sgd_dtm_estadofacturas')
    desc_rows   = api_get(token, 'sgd_dtm_descriptorescorrespondencia')

    # CON ACTA SINCO: descriptor "Contrato de Obra" CON valor → extrae No. Contrato (\d{6,})
    nc_con_acta = set()
    for r in desc_rows:
        if str(r.get('Nombre Descriptor', '')).strip().lower() == 'contrato de obra':
            valor = str(r.get('valor') or '')
            m = _re.search(r'\b(\d{6,})\b', valor)
            if m:
                nc_con_acta.add(int(m.group(1)))

    # CON ACTA EK: correspondencias SIN descriptor "Contrato de Obra"
    # Solo se puede ligar al macro/proyecto → set de Id Correspondencia EK
    corr_con_descriptor = {r['Id Correspondencia'] for r in desc_rows
                           if str(r.get('Nombre Descriptor', '')).strip().lower() == 'contrato de obra'}
    # IDs de correspondencias que tienen estadofacturas (tienen monto retegarantia)
    corr_con_estado = {r.get('correspondenciaid') for r in estado_rows}
    # EK = tiene estadofactura PERO no tiene descriptor "Contrato de Obra"
    corr_ek = corr_con_estado - corr_con_descriptor

    print(f'  Con Acta SINCO: {len(nc_con_acta):,} contratos con descriptor Contrato de Obra')
    print(f'  Con Acta EK   : {len(corr_ek):,} correspondencias sin descriptor (solo nivel macro)\n')

    # ── 4. Fact acta → acumulado total + saldoRte + saldoAnticipo ───────────
    # Valor Total: suma todos los ítems (cada fila es un ítem del acta)
    # Valor Retencion Garantias / Anticipo: se repite igual en cada fila del acta
    #   → deduplicar por (No Contrato, No Acta) y tomar una sola vez por acta
    print('[4/5] Fact actas (acumulado, retenciones y anticipos)...')
    fact_rows = api_get(token, 'adp_dtm_fact_acta')
    actas_vistas = set()   # (nc, no_acta) ya contabilizados para retenciones
    for r in fact_rows:
        nc_raw = r.get('No Contrato')
        if not nc_raw:
            continue
        nc = int(nc_raw)
        if nc not in contratos:
            continue
        # Acumulado: sumar siempre (ítems del acta)
        contratos[nc]['_acumulado'] += float(r.get('Valor Total') or 0)
        # Fecha más reciente de acta
        sf = int(r.get('skidfecha') or 0)
        if sf > contratos[nc]['_ultima_acta']:
            contratos[nc]['_ultima_acta'] = sf
        # Retenciones: una sola vez por acta
        no_acta = r.get('No Acta')
        clave = (nc, no_acta)
        if clave not in actas_vistas:
            actas_vistas.add(clave)
            rte_val = float(r.get('Valor Retencion Garantias') or 0)
            contratos[nc]['_saldoRte'] += rte_val
            if rte_val != 0:
                contratos[nc]['_tuvoRte'] = True
            ant_val = float(r.get('Valor Anticipo') or 0)
            if ant_val != 0:
                contratos[nc]['_tuvoAnticipo'] = True
            contratos[nc]['_saldoAnt'] += ant_val - float(r.get('Valor Retencion Anticipo') or 0)
        if contratos[nc]['_skidtercero'] is None and r.get('skidtercero', -1) != -1:
            contratos[nc]['_skidtercero'] = r['skidtercero']
    print(f'  Acumulados, retenciones y anticipos calculados\n')

    # ── 5. Dim tercero (cargado antes de fact_contrato para filtrar juridicas) ─
    print('[5/6] Terceros...')
    tercero_rows = api_get(token, 'adp_dtm_dim_tercero')
    tercero_map = {r['skidtercero']: r.get('nombre', '') for r in tercero_rows}
    juridicas = {r['skidtercero'] for r in tercero_rows if r.get('naturaleza') == 'J'}
    print(f'  {len(tercero_map):,} terceros | {len(juridicas):,} juridicos\n')

    # ── 5b. Dim estado por documento → mapa skidestado → descripcion ────────
    print('[5b/6] Estado por documento...')
    estado_doc_rows = api_get(token, 'adp_dtm_dim_estadopordocumento')
    # skidestadopordocumento → Descripcion Estado (solo CONTRATOS)
    skidestado_to_desc = {
        r['skidestadopordocumento']: str(r.get('Descripcion Estado') or '').strip()
        for r in estado_doc_rows
        if str(r.get('Tipo Documento') or '').upper() == 'CONTRATOS'
    }
    print(f'  {len(skidestado_to_desc)} estados de contrato mapeados\n')

    # ── 5c. Fact contrato → valor del contrato + skidtercero + skidestado ───
    # Cruce: fact_contrato.skidespecificaciondecontratos = dim.skidcontrato
    # Valor Contrato es el mismo en todas las filas del mismo contrato (no sumar)
    print('[5c/6] Fact contratos (valor contrato + tercero + estado)...')
    fact_cont_rows = api_get(token, 'adp_dtm_fact_contrato')
    for r in fact_cont_rows:
        skid = str(r.get('skidespecificaciondecontratos', ''))
        nc = skidcontrato_to_nc.get(skid)
        if nc is None or nc not in contratos:
            continue
        if contratos[nc]['_valorContrato'] == 0.0:
            contratos[nc]['_valorContrato'] = float(r.get('Valor Contrato') or 0)
        skid_t = r.get('skidtercero', -1)
        if skid_t != -1:
            curr = contratos[nc]['_skidtercero']
            # Preferir tercero juridico (empresa) sobre persona natural
            if curr is None or (skid_t in juridicas and curr not in juridicas):
                contratos[nc]['_skidtercero'] = skid_t
        # Estado desde dim_estadopordocumento
        skid_e = r.get('skidestado')
        if skid_e and contratos[nc].get('_skidestado') is None:
            contratos[nc]['_skidestado'] = skid_e
    print(f'  Valores de contrato, terceros y estado cargados\n')

    # (dim_tercero ya cargado en paso 5)

    # ── Construir registros ───────────────────────────────────────────────────
    records = []
    for nc, r in contratos.items():
        fecha_fin = parse_fecha(r.get('Fecha fin'))
        fecha_cierre = r.get('Fecha cierre') or ''
        nopago = r.get('nopago') is True
        vencido = fecha_fin < hoy if fecha_fin else False
        has_actas = r['_actas'] > 0
        acumulado      = round(r['_acumulado'], 2)
        saldo_rte      = round(max(r['_saldoRte'], 0), 2)
        saldo_ant      = round(max(r['_saldoAnt'], 0), 2)
        valor_contrato = round(r['_valorContrato'], 2)
        faltante       = round(valor_contrato - acumulado, 2)

        # Estado del contrato desde dim_estadopordocumento
        skid_e = r.get('_skidestado')
        estado = skidestado_to_desc.get(skid_e, '').strip() if skid_e else ''
        if not estado:
            # Fallback: lógica propia si no hay estado en el API
            if nopago or fecha_cierre:
                estado = 'Cerrado'
            elif has_actas:
                estado = 'Vencido' if vencido else 'Abierto'
            else:
                estado = 'Vencido' if vencido else 'Por Aprobación'

        skid_tercero = r['_skidtercero']
        contratista = tercero_map.get(skid_tercero, '') if skid_tercero else ''

        records.append({
            'noContrato':     str(nc),
            'contratista':    contratista,
            'fechaInicial':   r.get('Fecha inicio') or '',
            'fechaFinal':     r.get('Fecha fin')    or '',
            'descripcion':    r.get('descripcion')  or '',
            'estadoSinco':    estado,
            'ultimaActa':     r['_ultima_acta'],
            'valorContrato':  valor_contrato,
            'acumulado':      acumulado,
            'saldoAnticipo':  saldo_ant,
            'saldoRte':       saldo_rte,
            'faltante':       faltante,
            'conActa':        1 if nc in nc_con_acta else 0,
            'tuvoRteGarantia': r['_tuvoRte'],
            'tuvoAnticipo':    r['_tuvoAnticipo'],
            'proyecto':       r['_proyecto'],
            'grupo':          r.get('nombregrupo') or '',
        })

    print(f'Total contratos generados: {len(records):,}')

    # Estadísticas por macro
    from collections import Counter
    by_macro = Counter(r['_macro'] for r in contratos.values())
    by_estado = Counter(r['estadoSinco'] for r in records)
    print('\nPor macro:')
    for k, n in sorted(by_macro.items()):
        print(f'  {k}: {n}')
    print('\nPor estado:')
    for k, n in sorted(by_estado.items()):
        print(f'  {k}: {n}')

    # ── Escribir contracts_data.json ──────────────────────────────────────────
    corte = corte_hoy()
    if not records:
        print('\nERROR — Sin datos. No se sobreescribe el archivo existente.')
        return

    ts = datetime.datetime.now().strftime('%d %b %Y %H:%M')
    dest_path = os.path.normpath(DEST)
    output = {'corte': corte, 'generated_at': ts, 'data': records}
    with open(dest_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

    print(f'\nOK — {len(records):,} contratos escritos en contracts_data.json | Corte: {corte}')
    print(f'    → {dest_path}')

if __name__ == '__main__':
    main()
