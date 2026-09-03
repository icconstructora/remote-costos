"""
gen_anticipos_api.py  — Genera anticipos_data.json desde API Sinco
===================================================================
Fuentes:
  adp_dtm_fact_anticipo   → anticipos ADPRO por proyecto/tercero
  fin_dtm_saldos          → saldo cuenta 1405 por CC/tercero (A&F)
  fin_dtm_movimientos     → último movimiento cuenta 1405 por CC/tercero
  fin_dtm_centroscostos   → descripción de centros de costos
  fin_dtm_terceros        → nombre del proveedor por NIT

Campos del card A&F vs ADPRO por proyecto:
  ant_prov_af    = SUM saldo_final cuenta 1405 (A&F actual)
  ant_amort_adpro = SUM Valor Anticipo donde Porcentaje = 100 (ADPRO)
  saldo_adpro    = SUM Valor Anticipo × (1 - Porcentaje/100)
  sin_mov_2m     = SUM saldo 1405 de terceros sin movimiento en 1405 en últimos 2 meses
  n_sin_mov      = cantidad de terceros en esa condición
"""
import sys, os, json, datetime
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

try:
    import msal, requests
except ImportError:
    os.system(f'{sys.executable} -m pip install msal requests -q')
    import msal, requests

# ── Config ─────────────────────────────────────────────────────────────────────
CLIENT_ID = '1da0f9dd-cc35-489c-937b-c66387864730'
TENANT_ID = '129cb8aa-2444-49b4-acc9-3f6a696f1ff0'
SCOPE     = ['api://1da0f9dd-cc35-489c-937b-c66387864730/access_as_user']
API_BASE  = 'https://api.icconstructora.co/api/sinco/data'
BASE      = os.path.dirname(os.path.abspath(__file__))
CACHE_F   = os.path.join(BASE, 'token_cache.json')
_out_dir  = os.environ.get('OUTPUT_DIR') or os.path.join(BASE, '..', 'control-costos', 'public', 'data')
DEST      = os.path.join(_out_dir, 'anticipos_data.json')

# ── CC → claves de proyecto (igual que gen_balance_api.py) ────────────────────
CC_KEY_RULES = [
    ('pra-e1',  ['PRAIA NATURA ETAPA 1']),
    ('pra-e2',  ['PRAIA NATURA ETAPA 2']),
    ('pra-zc',  ['PRAIA NATURA COSTOS COMUNES']),
    ('opo-e12', ['RESERVA DE OPORTO ETAPA 1', 'RESERVA DE OPORTO ETAPA 2']),
    ('opo-e3',  ['RESERVA DE OPORTO ETAPA 3']),
    ('hac-e1',  ['LA HACIENDA ETAPA 1', 'HACIENDA ETAPA 1', 'LA HACIENDA JAMUNDI ETAPA 1']),
    ('hac-e3',  ['LA HACIENDA ETAPA 3', 'LA HACIENDA JAMUNDI ETAPA 3']),
    ('pri-e12', ['PRIMERA ESTE ETAPA 1 Y 2']),
    ('pri-zc',  ['PRIMERA ESTE COSTOS COMUNES']),
    ('azt-e1',  ['AZUL TURQUESA ETAPA 1']),
    ('azt-e2',  ['AZUL TURQUESA ETAPA 2']),
    ('azc-e1',  ['AZUL CELESTE ETAPA 1']),
    ('azc-e2',  ['AZUL CELESTE ETAPA 2']),
    ('azc-e3',  ['AZUL CELESTE ETAPA 3']),
    ('ver-e1',  ['VERDE VIVO ETAPA 1']),
    ('ver-e2',  ['VERDE VIVO ETAPA 2']),
    ('ver-e3',  ['VERDE VIVO ETAPA 3']),
    ('mit-11',  ['MITIKA ETAPA 1.1', 'MITIKA ETAPA 1,1', 'MITIKA ZONAS COMUNES', 'MITIKA COSTOS COMUNES']),
    ('mit-t5',  ['MITIKA ETAPA 1.2 TORRE 5', 'MITIKA ETAPA 1,2 TORRE 5']),
    ('mit-t6',  ['MITIKA ETAPA 1.2 TORRE 6', 'MITIKA ETAPA 1,2 TORRE 6']),
    ('mit-t7',  ['MITIKA ETAPA 1.2 TORRE 7', 'MITIKA ETAPA 1,2 TORRE 7']),
    ('mit-12',  ['MITIKA ETAPA 1.2', 'MITIKA ETAPA 1,2']),
    ('cai-e2b', ['CASTILLA IMPERIAL ETAPA 2B', 'CASTILLA ET 2B']),
    ('cai-zc',  ['CASTILLA IMPERIAL COSTOS COMUNES', 'CASTILLA IMPERIAL ZONAS COMUNES']),
    ('praia',    ['PRAIA NATURA']),
    ('oporto',   ['RESERVA DE OPORTO']),
    ('primera',  ['PRIMERA ESTE']),
    ('hacienda', ['LA HACIENDA']),
    ('bosque',   ['BOSQUE CENTRAL']),
    ('cast-l',   ['CASTILLA LIVING']),
    ('gaia',     ['GAIA']),
    ('azul-t',   ['AZUL TURQUESA']),
    ('azul-c',   ['AZUL CELESTE']),
    ('verde',    ['VERDE VIVO']),
    ('mitika',   ['MITIKA']),
    ('well',     ['WELL']),
    ('cast-i',   ['CASTILLA IMPERIAL']),
]

SUB_TO_MACRO = {
    'pra-e1':  'praia',   'pra-e2':  'praia',   'pra-zc':  'praia',
    'opo-e12': 'oporto',  'opo-e3':  'oporto',
    'hac-e1':  'hacienda','hac-e3':  'hacienda',
    'pri-e12': 'primera', 'pri-zc':  'primera',
    'azt-e1':  'azul-t',  'azt-e2':  'azul-t',
    'azc-e1':  'azul-c',  'azc-e2':  'azul-c',  'azc-e3':  'azul-c',
    'ver-e1':  'verde',   'ver-e2':  'verde',    'ver-e3':  'verde',
    'mit-11':  'mitika',
    'mit-t5':  'mit-12',  'mit-t6':  'mit-12',  'mit-t7':  'mit-12',
    'mit-12':  'mitika',
    'cai-e2b': 'cast-i',  'cai-zc':  'cast-i',
}

# skidproyecto (sin prefijo 100) → claves
SKID_KEYS = {
    105: ['pra-e1', 'praia'],  103: ['pra-e1', 'praia'],
    108: ['pra-e2', 'praia'],  344: ['pra-e2', 'praia'],
    101: ['pra-zc', 'praia'],
    117: ['opo-e12', 'oporto'], 116: ['opo-e12', 'oporto'],
    118: ['opo-e3',  'oporto'], 401: ['opo-e3',  'oporto'],
    125: ['pri-e12', 'primera'], 121: ['pri-e12', 'primera'],
    119: ['pri-zc',  'primera'],
    133: ['hac-e1', 'hacienda'], 131: ['hac-e1', 'hacienda'], 457: ['hac-e1', 'hacienda'],
    139: ['hac-e3', 'hacienda'],
    168: ['azt-e1', 'azul-t'], 167: ['azt-e1', 'azul-t'],
    169: ['azt-e2', 'azul-t'],
    174: ['azc-e1', 'azul-c'], 173: ['azc-e1', 'azul-c'],
    175: ['azc-e2', 'azul-c'],
    176: ['azc-e3', 'azul-c'],
    180: ['ver-e1', 'verde'],
    181: ['ver-e2', 'verde'], 179: ['ver-e2', 'verde'],
    182: ['ver-e3', 'verde'],
    186: ['mit-11', 'mitika'], 184: ['mit-11', 'mitika'], 185: ['mit-11', 'mitika'],
    408: ['mit-t5', 'mit-12', 'mitika'], 409: ['mit-t5', 'mit-12', 'mitika'],
    187: ['mit-t6', 'mit-12', 'mitika'], 189: ['mit-t6', 'mit-12', 'mitika'],
    188: ['mit-t7', 'mit-12', 'mitika'], 337: ['mit-t7', 'mit-12', 'mitika'],
    201: ['cai-e2b', 'cast-i'], 195: ['cai-e2b', 'cast-i'],
    193: ['cai-zc',  'cast-i'],
    160: ['gaia'],   162: ['gaia'],
    147: ['bosque'], 143: ['bosque'],
    155: ['cast-l'], 157: ['cast-l'],
    190: ['well'],   192: ['well'],
}

def cc_to_keys(desc_upper):
    matched = []
    for key, substrings in CC_KEY_RULES:
        if any(s.upper() in desc_upper for s in substrings):
            matched.append(key)
    return matched

def get_ancestors(key):
    ancestors, k = [], key
    while k in SUB_TO_MACRO:
        k = SUB_TO_MACRO[k]
        ancestors.append(k)
    return ancestors

def skid_to_keys(skid_raw):
    # skidproyecto viene como 100NNN → NNN = skid sin prefijo 100
    try:
        skid = int(str(skid_raw)) % 100000  # quitar prefijo empresa 100
        return SKID_KEYS.get(skid, [])
    except Exception:
        return []

# ── Auth ───────────────────────────────────────────────────────────────────────
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
        CLIENT_ID, authority=f'https://login.microsoftonline.com/{TENANT_ID}',
        token_cache=cache)
    accounts = app.get_accounts()
    result = app.acquire_token_silent(SCOPE, account=accounts[0]) if accounts else None
    if not result:
        flow = app.initiate_device_flow(scopes=SCOPE)
        print(f'\n  Abre: {flow["verification_uri"]}')
        print(f'  Código: {flow["user_code"]}\n')
        result = app.acquire_token_by_device_flow(flow)
    if 'access_token' not in result:
        raise RuntimeError(result.get('error_description', str(result)))
    if cache.has_state_changed:
        open(CACHE_F, 'w', encoding='utf-8').write(cache.serialize())
    return result['access_token']

def api_get(token, tabla, timeout=120):
    url = f'{API_BASE}/{tabla}'
    headers = {'Authorization': f'Bearer {token}'}
    print(f'  GET {tabla}...', flush=True)
    r = requests.get(url, headers=headers, timeout=timeout, stream=True)
    if not r.ok:
        print(f'    HTTP {r.status_code}')
        return []
    chunks = []
    for chunk in r.iter_content(chunk_size=512*1024):
        if chunk:
            chunks.append(chunk)
    rows = json.loads(b''.join(chunks))
    print(f'    {len(rows):,} filas')
    return rows if isinstance(rows, list) else []

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print('='*60)
    print('  IC CONSTRUCTORA - gen_anticipos_api.py')
    print('  Fuente: adp_dtm_fact_anticipo + fin_dtm_*')
    print('='*60)

    token = get_token()
    print('Token OK\n')

    hoy = datetime.date.today()
    # Límite: movimiento "reciente" = solo el mes anterior y el actual
    # Con granularidad mensual, junio = >2m atrás cuando estamos en agosto
    mes_limite = hoy.month - 1
    anio_limite = hoy.year
    if mes_limite <= 0:
        mes_limite += 12
        anio_limite -= 1
    fecha_limite = datetime.date(anio_limite, mes_limite, 1)
    fecha_limite_int = int(fecha_limite.strftime('%Y%m%d'))
    print(f'Fecha límite sin movimiento: {fecha_limite} ({fecha_limite_int})\n')

    # ── 0. Terceros NIT → nombre ────────────────────────────────────────────────
    print('[0/5] Terceros...')
    ter_rows = api_get(token, 'fin_dtm_terceros')
    nit_nombre = {r.get('numero_identificacion_tercero', ''): (r.get('nombre_tercero') or '').strip()
                  for r in ter_rows}
    print(f'  Terceros fin: {len(nit_nombre)}')

    # adp_dtm_dim_tercero: skidtercero → nit y nombre (para ADPRO)
    dim_rows = api_get(token, 'adp_dtm_dim_tercero', timeout=300)
    skid_to_nit    = {r['skidtercero']: str(r.get('nit') or '').strip()    for r in dim_rows if 'skidtercero' in r}
    skid_to_nombre = {r['skidtercero']: (r.get('nombre') or '').strip()    for r in dim_rows if 'skidtercero' in r}
    # enriquecer nit_nombre con los nombres de adp
    for skid, nit in skid_to_nit.items():
        if nit and nit not in nit_nombre:
            nit_nombre[nit] = skid_to_nombre.get(skid, '')
    print(f'  Terceros adp: {len(skid_to_nit)}')

    # ── 1. CC → keys ────────────────────────────────────────────────────────────
    print('\n[1/5] Centros de costos...')
    cc_rows = api_get(token, 'fin_dtm_centroscostos')
    cc_info = {}
    for r in cc_rows:
        cod  = r.get('centro_costos', '')
        desc = (r.get('centro_costos_descripcion') or '').strip()
        keys = cc_to_keys(desc.upper())
        if keys:
            cc_info[cod] = {'desc': desc, 'keys': keys}
    print(f'  CCs mapeados: {len(cc_info)}')

    # ── 2. fin_dtm_saldos → saldo cuenta 1405 por (key, nit) para sin_mov ───────
    print('\n[2/5] Saldos cuenta 1405 (fin_dtm_saldos)...')
    sal_rows = api_get(token, 'fin_dtm_saldos')

    # saldo_by_key_nit: saldo_final por (cc, nit) — para sin_mov_2m
    # deb_sal_by_key / cred_sal_by_key: débitos/créditos históricos por período en saldos
    saldo_by_key_nit = defaultdict(lambda: defaultdict(float))
    deb_sal_by_key   = defaultdict(float)
    cred_sal_by_key  = defaultdict(float)

    for r in sal_rows:
        cuenta = str(r.get('cuenta_contable', ''))
        if not cuenta.startswith('1405'):
            continue
        cc_cod = r.get('centro_costos', '')
        info   = cc_info.get(cc_cod)
        if not info:
            continue
        nit = str(r.get('numero_identificacion_tercero') or '').strip()
        if not nit:  # ignorar filas resumen sin tercero
            continue
        sf  = float(r.get('saldo_final') or 0)
        deb = float(r.get('debito') or 0)
        crd = float(r.get('credito') or 0)
        for key in info['keys']:
            saldo_by_key_nit[key][(cc_cod, nit)] += sf
            deb_sal_by_key[key]  += deb
            cred_sal_by_key[key] += crd

    # ── 3. fin_dtm_movimientos → acumulados históricos cuenta 1405 ─────────────
    # débitos = total girado A&F | créditos = total amortizado A&F
    # saldo_af = débitos - créditos  (igual que Sinco A&F)
    print('\n[3/5] Movimientos cuenta 1405 (fin_dtm_movimientos)...')
    mov_rows = api_get(token, 'fin_dtm_movimientos')

    # fin_dtm_saldos tiene el saldo acumulado previo al período actual.
    # fin_dtm_movimientos tiene los movimientos adicionales del período en curso.
    # saldo_af = saldo_final (saldos) + deb_mov - cred_mov
    deb_mov_by_key    = defaultdict(float)   # débitos período actual por proyecto
    cred_mov_by_key   = defaultdict(float)   # créditos período actual por proyecto
    # saldo histórico por (cc, nit): SUM(debito) - SUM(credito) de toda la historia
    deb_hist_cc_nit   = defaultdict(float)
    cred_hist_cc_nit  = defaultdict(float)
    last_mov_cc_nit   = {}                   # (cc, nit) → última fecha YYYYMMDD con movimiento
    # has_recent_mov: (cc, nit) con movimiento en los últimos 2 meses
    has_recent_mov    = set()

    for r in mov_rows:
        cuenta = str(r.get('cuenta_contable', ''))
        if not cuenta.startswith('1405'):
            continue
        cc_cod = r.get('centro_costos', '')
        info   = cc_info.get(cc_cod)
        if not info:
            continue
        nit  = str(r.get('numero_identificacion_tercero') or '').strip()
        if not nit:
            continue
        anio = int(r.get('anio') or 0)
        mes  = int(r.get('mes')  or 0)
        deb  = float(r.get('debito')  or 0)
        cred = float(r.get('credito') or 0)
        cc_nit = (cc_cod, nit)
        if deb  > 0: deb_hist_cc_nit[cc_nit]  += deb
        if cred > 0: cred_hist_cc_nit[cc_nit] += cred
        if anio and mes:
            fecha_int = anio * 10000 + mes * 100 + 1
            if deb > 0 or cred > 0:
                if fecha_int > last_mov_cc_nit.get(cc_nit, 0):
                    last_mov_cc_nit[cc_nit] = fecha_int
            if fecha_int >= fecha_limite_int and (deb > 0 or cred > 0):
                has_recent_mov.add(cc_nit)
        for key in info['keys']:
            if deb  > 0: deb_mov_by_key[key]  += deb
            if cred > 0: cred_mov_by_key[key] += cred

    # fin_dtm_saldos solo tiene saldo_final (sin campos debito/credito separados).
    # ant_prov_af  = saldo_final(saldos) + deb(movimientos)  ← balance previo + girado en el período
    # ant_amort_af = cred(movimientos)                        ← amortizado en el período
    # saldo_af     = saldo_final(saldos) + deb_mov - cred_mov ← balance actual
    all_af_keys = set(saldo_by_key_nit) | set(deb_mov_by_key)
    ant_prov_af_total  = {}
    ant_amort_af_total = {}
    saldo_af_by_key    = {}
    for k in all_af_keys:
        previo = sum(saldo_by_key_nit.get(k, {}).values())
        deb_mov = deb_mov_by_key.get(k, 0)
        cred_mov = cred_mov_by_key.get(k, 0)
        ant_prov_af_total[k]  = round(previo + deb_mov, 2)
        ant_amort_af_total[k] = round(cred_mov, 2)
        saldo_af_by_key[k]    = round(previo + deb_mov - cred_mov, 2)

    print(f'  Pares (cc, nit) con movimiento reciente en 1405: {len(has_recent_mov)}')
    print(f'  Proyectos con saldo A&F 1405: {len(saldo_af_by_key)}')

    # ── 4. adp_dtm_fact_anticipo → girado ADPRO por key ────────────────────────
    print('\n[4/6] Anticipos ADPRO — girado (adp_dtm_fact_anticipo)...')
    ant_rows = api_get(token, 'adp_dtm_fact_anticipo')

    adpro_total_by_key  = defaultdict(float)   # total anticipos girados (histórico)
    adpro_gir_by_nit    = defaultdict(float)   # girado por (key, nit)
    adpro_amort_by_nit  = defaultdict(float)   # amortizado por (key, nit)
    adpro_saldo_by_nit  = defaultdict(float)   # saldo (Valor × (1-Pct/100)) por (key, nit)

    for r in ant_rows:
        skid_raw = r.get('skidproyecto')
        keys = skid_to_keys(skid_raw)
        if not keys:
            continue
        val = float(r.get('Valor Anticipo') or 0)
        pct = float(r.get('Porcentaje') or 0)
        saldo_r = val * (1 - pct / 100)
        nit_ant = skid_to_nit.get(r.get('skidtercero'), '')
        for key in keys:
            adpro_total_by_key[key] += val
            if nit_ant:
                adpro_gir_by_nit[(key, nit_ant)]   += val
                adpro_saldo_by_nit[(key, nit_ant)] += saldo_r

    # ── 4b. adp_dtm_fact_entradasalmacen → amortizado ADPRO por key ─────────────
    # Cada "skidespecificacionentradasalmacen" es una línea única; el campo
    # "Entrada Valor Amortizado" se repite por fila pero debe contarse solo una vez.
    print('\n[5/6] Anticipos ADPRO — amortizado (adp_dtm_fact_entradasalmacen)...')
    ent_rows = api_get(token, 'adp_dtm_fact_entradasalmacen')

    adpro_amort_by_key = defaultdict(float)   # amortizado real (deduplicado)
    seen_espec = set()                         # dedup por skidespecificacionentradasalmacen

    for r in ent_rows:
        skid_raw = r.get('skidproyecto')
        keys = skid_to_keys(skid_raw)
        if not keys:
            continue
        espec_id = r.get('skidespecificacionentradasalmacen')
        if espec_id is None:
            # Si no hay ID único, usar tupla compuesta
            espec_id = (r.get('skidproyecto'), r.get('skidfechaentrada'),
                        r.get('skidtercero'), r.get('skidinsumo'),
                        r.get('Entrada Valor Amortizado'))
        if espec_id in seen_espec:
            continue
        seen_espec.add(espec_id)
        val_amort = float(r.get('Entrada Valor Amortizado') or 0)
        nit_ent = skid_to_nit.get(r.get('skidtercero'), '')
        for key in keys:
            adpro_amort_by_key[key] += val_amort
            if nit_ent:
                adpro_amort_by_nit[(key, nit_ent)] += val_amort

    # saldo = girado - amortizado (deduplicado)
    adpro_saldo_by_key = {k: adpro_total_by_key[k] - adpro_amort_by_key.get(k, 0)
                          for k in adpro_total_by_key}

    # ── 6. Calcular sin_mov_2m por key ─────────────────────────────────────────
    print('\n[6/6] Calculando Ant. >2 meses sin mov...')
    sin_mov_by_key        = defaultdict(float)
    n_sin_mov_by_key      = defaultdict(int)
    sin_mov_detalle_by_key = defaultdict(list)

    # Construir saldo por (cc, nit) = sf_saldos + deb_hist_mov - cred_hist_mov
    all_cc_nits = (set(deb_hist_cc_nit.keys()) | set(cred_hist_cc_nit.keys())
                   | {cc_nit for key_map in saldo_by_key_nit.values()
                      for cc_nit in key_map if key_map[cc_nit] != 0})
    # Acumular saldo y días por (key, nit) — un mismo NIT puede tener CCs en varias etapas
    sin_mov_saldo_acc = defaultdict(lambda: defaultdict(float))
    sin_mov_dias_acc  = defaultdict(dict)  # key → {nit: dias_sin | None}
    for cc_nit in all_cc_nits:
        cc_cod, nit = cc_nit
        info = cc_info.get(cc_cod)
        if not info:
            continue
        # sf_nit: saldo único por CC — usar primera key para evitar duplicar el mismo valor
        sf_nit = saldo_by_key_nit.get(info['keys'][0], {}).get(cc_nit, 0) if info['keys'] else 0
        saldo_nit = sf_nit + deb_hist_cc_nit.get(cc_nit, 0) - cred_hist_cc_nit.get(cc_nit, 0)
        if abs(saldo_nit) < 1:
            continue
        if cc_nit not in has_recent_mov:
            ult_fecha = last_mov_cc_nit.get(cc_nit, 0)
            if ult_fecha:
                f_int = int(ult_fecha)
                ult_date = datetime.date(f_int // 10000, (f_int % 10000) // 100, f_int % 100)
                dias_sin = (hoy - ult_date).days
            else:
                dias_sin = None
            for key in info['keys']:
                sin_mov_saldo_acc[key][nit] += saldo_nit
                existing = sin_mov_dias_acc[key].get(nit, 'unset')
                if existing == 'unset':
                    sin_mov_dias_acc[key][nit] = dias_sin
                elif existing is None or dias_sin is None:
                    sin_mov_dias_acc[key][nit] = None
                else:
                    sin_mov_dias_acc[key][nit] = min(existing, dias_sin)
    # Convertir acumulados a listas de detalle
    for key in sin_mov_saldo_acc:
        for nit, saldo_total in sin_mov_saldo_acc[key].items():
            if abs(saldo_total) < 1:
                continue
            dias_sin = sin_mov_dias_acc[key].get(nit)
            sin_mov_by_key[key]   += saldo_total
            n_sin_mov_by_key[key] += 1
            sin_mov_detalle_by_key[key].append({
                'nit':          nit,
                'nombre':       nit_nombre.get(nit, nit),
                'dias_sin_mov': dias_sin,
                'saldo':        round(saldo_total, 2),
            })

    # ── 6. Construir resultado ──────────────────────────────────────────────────
    print('\nConstruyendo anticipos_data.json...')

    MESES_ES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    corte = f'{hoy.day} {MESES_ES[hoy.month]} {hoy.year}'

    all_keys = (set(saldo_af_by_key) | set(adpro_saldo_by_key) | set(sin_mov_by_key))
    result = {}

    for key in sorted(all_keys):
        saldo_af_val   = round(saldo_af_by_key.get(key, 0), 2)        # saldo A&F actual
        ant_prov_af    = round(ant_prov_af_total.get(key, 0), 2)      # total girado A&F
        ant_amort_af   = round(ant_amort_af_total.get(key, 0), 2)     # total amortizado A&F
        ant_amort_adpro = round(adpro_amort_by_key.get(key, 0), 2)
        saldo_adpro    = round(adpro_saldo_by_key.get(key, 0), 2)
        sin_mov        = round(sin_mov_by_key.get(key, 0), 2)
        n_sin_mov      = n_sin_mov_by_key.get(key, 0)

        # % Amortizado A&F: lo que ya se amortizó / (saldo actual + amortizado)
        # Amortizado A&F ≈ lo que salió de 1405 como crédito acumulado
        # = adpro_amort como proxy, o bien: total - saldo_af_actual
        # Usamos: saldo_af = lo que queda; total_desembolsado = ant_prov_af + crédito acumulado
        # Como no tenemos crédito 1405 separado aún, dejamos pct_amort vacío si falta dato
        total_adpro = round(adpro_total_by_key.get(key, 0), 2)
        # % Amortizado = amortizado (entradasalmacen) / girado total (fact_anticipo)
        ant_amort_val = round(adpro_amort_by_key.get(key, 0), 2)
        pct_amort_raw = ant_amort_val / total_adpro * 100 if total_adpro > 0 else 0.0
        pct_amort     = round(max(0.0, min(100.0, pct_amort_raw)), 1)

        # Ant. amortizado = entradas almacén (ADPRO, deduplicado)
        ant_amort = ant_amort_val

        diferencia = round(saldo_af_val - saldo_adpro, 2)  # Diferencia saldo A&F vs saldo ADPRO

        # irr_terceros: saldo A&F real por NIT = saldo_final + deb_hist - cred_hist
        nit_saldo = defaultdict(float)
        seen_nit = set()
        for (cc_cod, nit), sf in saldo_by_key_nit.get(key, {}).items():
            if not nit:
                continue
            cc_nit = (cc_cod, nit)
            actual = sf + deb_hist_cc_nit.get(cc_nit, 0) - cred_hist_cc_nit.get(cc_nit, 0)
            if actual >= 1:
                nit_saldo[nit] += actual
                seen_nit.add(nit)
        # también incluir NITs que solo aparecen en movimientos (sin saldo previo)
        for (cc_cod, nit) in set(deb_hist_cc_nit.keys()) | set(cred_hist_cc_nit.keys()):
            if not nit or nit in seen_nit:
                continue
            info = cc_info.get(cc_cod)
            if not info or key not in info['keys']:
                continue
            actual = deb_hist_cc_nit.get((cc_cod, nit), 0) - cred_hist_cc_nit.get((cc_cod, nit), 0)
            if actual >= 1:
                nit_saldo[nit] += actual
        irr_list = []
        for nit, saldo_af_nit in sorted(nit_saldo.items(), key=lambda x: -x[1]):
            gir_nit   = adpro_gir_by_nit.get((key, nit), 0)
            gir_total = adpro_total_by_key.get(key, 0)
            saldo_key = adpro_saldo_by_key.get(key, 0)
            if gir_total > 0:
                s_adpro = round(gir_nit / gir_total * saldo_key, 2)
            else:
                s_adpro = round(gir_nit - adpro_amort_by_nit.get((key, nit), 0), 2)
            s_af    = round(saldo_af_nit, 2)
            if abs(s_af - s_adpro) < 100:
                continue
            irr_list.append({
                'nit':        nit,
                'nombre':     nit_nombre.get(nit, nit),
                'saldo_adpro': s_adpro,
                'saldo_af':   s_af,
            })
        irr_terceros = irr_list

        result[key] = {
            'ant_prov':      total_adpro,       # girado ADPRO (fact_anticipo)
            'ant_amort':     ant_amort,          # amortizado ADPRO (entradasalmacen dedup)
            'ant_prov_af':   ant_prov_af,        # girado A&F (deb 1405 histórico)
            'ant_amort_af':  ant_amort_af,       # amortizado A&F (cred 1405 histórico)
            'saldo_af':      saldo_af_val,       # saldo A&F = deb - cred
            'saldo_adpro':   saldo_adpro,        # saldo ADPRO = girado - amortizado
            'diferencia':    diferencia,         # saldo A&F - saldo ADPRO
            'sin_mov':          sin_mov,
            'n_sin_mov':        n_sin_mov,
            'sin_mov_terceros': sorted(sin_mov_detalle_by_key.get(key, []), key=lambda x: -(x['saldo'] or 0)),
            'pct_amort':        pct_amort,
            'irr_terceros':     irr_terceros,
            'n_irr':            len(irr_terceros),
        }

        print(f'  {key:12s}: saldo_af={saldo_af_val/1e6:6.1f}M  saldo_adpro={saldo_adpro/1e6:6.1f}M  dif={diferencia/1e6:+.1f}M')

    # ── Escribir JSON ───────────────────────────────────────────────────────────
    if not result:
        print('\nERROR — Sin datos. No se sobreescribe el archivo existente.')
        return

    ts = datetime.datetime.now().strftime('%d %b %Y %H:%M')
    output = {'corte': corte, 'generated_at': ts, 'data': result}
    dest_path = os.path.normpath(DEST)
    with open(dest_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

    print(f'\nOK — anticipos_data.json | {len(result)} proyectos | Corte: {corte}')
    print(f'    → {dest_path}')

if __name__ == '__main__':
    main()
