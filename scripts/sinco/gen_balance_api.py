"""
gen_balance_api.py  – Genera balance_data.js desde API Sinco (fin_dtm_*)
==========================================================================
Reemplaza gen_balance.py (Excel) usando:
  fin_dtm_saldos         → saldo_final por cuenta/CC/tercero
  fin_dtm_centroscostos  → descripcion de centros de costos
  fin_dtm_terceros       → nombre del contratista por NIT

Cuentas usadas:
  1405*  → Anticipo Proveedores
  1490*  → Ant. Contratistas
  2220*  → Dev. Ret. Garantía
  2825*  → Gta. Cumplimiento

liq / liq_ant: se calculan desde fin_dtm_movimientos (débitos en 2825*)
  liq     = débitos del mes actual (devoluciones en curso)
  liq_ant = débitos de meses anteriores
"""
import sys, os, json, datetime, re as _re
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
DEST      = os.path.join(_out_dir, 'balance_data.json')

# ── Cuentas → categoría ────────────────────────────────────────────────────────
ACCT_PREFIX = {
    '1405100101': 'Anticipo Proveedores',  # cuenta exacta
    '1490100501': 'Ant. Contratistas',    # cuenta exacta
    '2220060001': 'Dev. Ret. Garantía',   # cuenta exacta
    '2825150101': 'Gta. Cumplimiento',    # cuentas exactas
    '2825150102': 'Gta. Cumplimiento',
}

def acct_cat(cuenta):
    # Cuenta exacta tiene prioridad; luego por prefijo
    if cuenta in ACCT_PREFIX:
        return ACCT_PREFIX[cuenta]
    for prefix, cat in ACCT_PREFIX.items():
        if len(prefix) < len(cuenta) and cuenta.startswith(prefix):
            return cat
    return None

# ── Centros de costos → clave(s) de proyecto ───────────────────────────────────
# Orden importante: más específico primero para evitar doble conteo.
# Cada CC se asigna a TODAS las claves que coincidan (sub-proyecto Y macro).
CC_KEY_RULES = [
    # ── Sub-proyectos (más específicos primero) ──
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
    # ── Macros (todos sus sub-CCs quedan incluidos también) ──
    ('praia',    ['PRAIA NATURA']),
    ('oporto',   ['RESERVA DE OPORTO']),
    ('primera',  ['PRIMERA ESTE']),
    ('hacienda', ['LA HACIENDA']),
    ('hac-real', ['HACIENDA REAL']),
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

# ── Sub-clave → macro (para propagar Con Acta a la vista "Todo") ──────────────
# Cada clave apunta a su padre inmediato; la propagación sube toda la cadena.
# mit-t5/t6/t7 → mit-12 → mitika (dos niveles)
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

def get_ancestors(key):
    """Retorna todos los ancestros de key, del más cercano al raíz."""
    ancestors, k = [], key
    while k in SUB_TO_MACRO:
        k = SUB_TO_MACRO[k]
        ancestors.append(k)
    return ancestors

# ── ADPRO → macro (para Con Acta de EK) ───────────────────────────────────────
ADPRO_MACROS = {
    'PRAIA NATURA':        'praia',
    'RESERVA DE OPORTO':   'oporto',
    'PRIMERA ESTE':        'primera',
    'LA HACIENDA JAMUNDI': 'hacienda',
    'BOSQUE CENTRAL':      'bosque',
    'CASTILLA LIVING':     'cast-l',
    'GAIA':                'gaia',
    'AZUL TURQUESA':       'azul-t',
    'AZUL CELESTE':        'azul-c',
    'VERDE VIVO':          'verde',
    'MITIKA':              'mitika',
    'WELL':                'well',
    'CASTILLA IMPERIAL':   'cast-i',
}

def adpro_to_macro(adpro):
    txt = str(adpro or '').upper().replace('OBRA:', '').strip()
    for prefix, key in ADPRO_MACROS.items():
        if txt.startswith(prefix):
            return key
    return None

# ── Skid → claves de proyecto (sub + macro) ────────────────────────────────────
# Cada contrato Sinco codifica el skid: nc[1:3] = str(skid-100).zfill(2) para skids 101-199
# Ejemplo: CONT1050098 → skid = 100 + int("05") = 105 → ['pra-e1','praia']
SKID_KEYS = {
    # Praia
    105: ['pra-e1', 'praia'],  103: ['pra-e1', 'praia'],
    108: ['pra-e2', 'praia'],  344: ['pra-e2', 'praia'],
    101: ['pra-zc', 'praia'],
    # Oporto
    117: ['opo-e12', 'oporto'], 116: ['opo-e12', 'oporto'],
    118: ['opo-e3',  'oporto'], 401: ['opo-e3',  'oporto'],
    # Primera
    125: ['pri-e12', 'primera'], 121: ['pri-e12', 'primera'],
    119: ['pri-zc',  'primera'],
    # Hacienda
    133: ['hac-e1', 'hacienda'], 131: ['hac-e1', 'hacienda'],
    457: ['hac-e1', 'hacienda'],
    139: ['hac-e3', 'hacienda'],
    # Azul Turquesa
    168: ['azt-e1', 'azul-t'], 167: ['azt-e1', 'azul-t'],
    169: ['azt-e2', 'azul-t'],
    # Azul Celeste
    174: ['azc-e1', 'azul-c'], 173: ['azc-e1', 'azul-c'],
    175: ['azc-e2', 'azul-c'],
    176: ['azc-e3', 'azul-c'],
    # Verde
    180: ['ver-e1', 'verde'],
    181: ['ver-e2', 'verde'], 179: ['ver-e2', 'verde'],
    182: ['ver-e3', 'verde'],
    # Mitika
    186: ['mit-11', 'mitika'], 184: ['mit-11', 'mitika'], 185: ['mit-11', 'mitika'],
    408: ['mit-t5', 'mit-12', 'mitika'], 409: ['mit-t5', 'mit-12', 'mitika'],
    187: ['mit-t6', 'mit-12', 'mitika'], 189: ['mit-t6', 'mit-12', 'mitika'],
    188: ['mit-t7', 'mit-12', 'mitika'], 337: ['mit-t7', 'mit-12', 'mitika'],
    # Castilla Imperial
    201: ['cai-e2b', 'cast-i'], 195: ['cai-e2b', 'cast-i'],
    193: ['cai-zc',  'cast-i'],
    # Sin sub-proyectos
    160: ['gaia'],   162: ['gaia'],
    147: ['bosque'], 143: ['bosque'],
    155: ['cast-l'], 157: ['cast-l'],
    190: ['well'],   192: ['well'],
}

def nc_to_keys(nc_str, fallback_macro=None):
    """Deriva claves de proyecto desde número de contrato Sinco.
    Formato: 1 + ZZ + sequential donde skid = 100 + int(ZZ).
    Fallback al macro si el skid no está mapeado."""
    try:
        skid = 100 + int(str(nc_str).strip()[1:3])
        keys = SKID_KEYS.get(skid)
        if keys:
            return keys
    except (ValueError, IndexError):
        pass
    return [fallback_macro] if fallback_macro else []

def parse_val(v):
    try:
        return float(str(v or '0').replace(',', '').replace(' ', ''))
    except Exception:
        return 0.0

def cc_to_keys(desc_upper):
    """Devuelve todas las claves que coinciden con la descripción del CC."""
    matched = []
    for key, substrings in CC_KEY_RULES:
        if any(s.upper() in desc_upper for s in substrings):
            matched.append(key)
    return matched

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

def api_get(token, tabla):
    url = f'{API_BASE}/{tabla}'
    headers = {'Authorization': f'Bearer {token}'}
    print(f'  GET {tabla}...', flush=True)
    for intento in range(3):
        try:
            r = requests.get(url, headers=headers, timeout=300, stream=True)
            if not r.ok:
                print(f'    HTTP {r.status_code}')
                return []
            chunks = []
            for chunk in r.iter_content(chunk_size=512*1024):
                if chunk: chunks.append(chunk)
            rows = json.loads(b''.join(chunks))
            print(f'    {len(rows):,} filas')
            return rows if isinstance(rows, list) else []
        except Exception as e:
            if intento < 2:
                print(f'    Reintento {intento+1}/3 ({e.__class__.__name__})...')
            else:
                raise

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print('='*60)
    print('  IC CONSTRUCTORA - gen_balance_api.py')
    print('  Fuente: API fin_dtm_*')
    print('='*60)

    token = get_token()
    print('Token OK\n')

    hoy = datetime.date.today()
    anio_actual, mes_actual = hoy.year, hoy.month

    # ── 1. Dimensiones ────────────────────────────────────────────────────────
    print('[1/4] Dimensiones...')
    cc_rows  = api_get(token, 'fin_dtm_centroscostos')
    ter_rows = api_get(token, 'fin_dtm_terceros')

    # CC code → descripcion y keys de proyecto
    cc_info = {}  # codigo → {desc, keys}
    for r in cc_rows:
        cod  = r.get('centro_costos', '')
        desc = (r.get('centro_costos_descripcion') or '').strip()
        keys = cc_to_keys(desc.upper())
        if keys:
            cc_info[cod] = {'desc': desc, 'keys': keys}

    # NIT → nombre
    nit_nombre = {r['numero_identificacion_tercero']: r.get('nombre_tercero', '')
                  for r in ter_rows}

    print(f'  CCs mapeados: {len(cc_info)}')

    # ── 2. Saldos (fin_dtm_saldos) ───────────────────────────────────────────
    print('\n[2/4] Saldos (fin_dtm_saldos)...')
    sal_rows = api_get(token, 'fin_dtm_saldos')

    # by_key[key][cat][(cc_desc, nit)] = saldo acumulado
    by_key = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    liq_sal_by_key  = defaultdict(float)  # saldo_final 2220060001
    comp_sal_by_key = defaultdict(float)  # saldo_final 2220060001 (base para completado)

    for r in sal_rows:
        cuenta = r.get('cuenta_contable', '')
        cat    = acct_cat(cuenta)
        cc_cod = r.get('centro_costos', '')
        info   = cc_info.get(cc_cod)
        if not info:
            continue
        sf  = float(r.get('saldo_final') or 0)
        nit = r.get('numero_identificacion_tercero', '')
        if cat:
            for key in info['keys']:
                by_key[key][cat][(info['desc'], nit)] += sf
        # Cuenta específica 2220060001
        if cuenta == '2220060001':
            for key in info['keys']:
                liq_sal_by_key[key]  += sf
                comp_sal_by_key[key] += sf

    # ── 2b. Movimientos → ajuste de saldo + liq/liq_ant ─────────────────────
    print('\n[2b/4] Movimientos (fin_dtm_movimientos)...')
    mov_rows = api_get(token, 'fin_dtm_movimientos')

    liq_by_key       = defaultdict(float)
    liq_ant_by_key   = defaultdict(float)
    liq_mov_by_key   = defaultdict(float)   # débito - crédito de 2220060001
    comp_cred_by_key = defaultdict(float)   # crédito acumulado de 2220060001
    gta_pag_by_key   = defaultdict(lambda: defaultdict(float))  # key → nit → monto pagado

    for r in mov_rows:
        cuenta = r.get('cuenta_contable', '')
        cat    = acct_cat(cuenta)
        cc_cod = r.get('centro_costos', '')
        info   = cc_info.get(cc_cod)
        if not info:
            continue
        cred = float(r.get('credito') or 0)
        deb  = float(r.get('debito')  or 0)
        nit  = r.get('numero_identificacion_tercero', '')
        anio = int(r.get('anio') or 0)
        mes  = int(r.get('mes')  or 0)

        if cat:
            # Ajuste de movimientos al saldo:
            #   Cuentas 1* (activos):  + (débito - crédito)
            #   Cuentas 2* (pasivos):  + (crédito - débito)
            if cuenta.startswith('1'):
                ajuste = deb - cred
            else:
                ajuste = cred - deb
            for key in info['keys']:
                by_key[key][cat][(info['desc'], nit)] += ajuste
                # Devoluciones de garantía (débitos 2825*) → liq / liq_ant + gta pagadas por tercero
                if cuenta.startswith('2825') and deb >= 1:
                    if anio == anio_actual and mes == mes_actual:
                        liq_by_key[key] += deb
                    else:
                        liq_ant_by_key[key] += deb
                    gta_pag_by_key[key][nit] += deb

        # Cuenta específica 2220060001 (pasivo: saldo normal = crédito)
        if cuenta == '2220060001':
            for key in info['keys']:
                liq_mov_by_key[key]   += cred - deb   # liquidado: balance actual (pasivo = cred-deb)
                comp_cred_by_key[key] += cred          # completado: crédito acumulado

    # ── 2c. Con Acta: filtrar por estadofacturas.actividad F019/F029 ────────────
    print('\n[2c/4] Con Acta SGD (estadofacturas.actividad F019/F029 + sin factura + activos)...')

    # Paso 1: de estadofacturas tomar las filas con actividad F019/F029,
    #         No. Factura vacío, estado no CANCELADA ni COMPLETADA
    estado_sgd   = api_get(token, 'sgd_dtm_estadofacturas')
    candidatos   = set()   # correspondenciaid válidos
    cid_to_adpro = {}

    cid_to_proveedor = {}

    for r in estado_sgd:
        actividad = str(r.get('actividad') or '')
        if 'F019' not in actividad and 'F029' not in actividad:
            continue
        estado = str(r.get('estado') or '').upper().strip()
        if estado == 'CANCELADA':
            continue
        if str(r.get('No. Factura') or '').strip():
            continue
        cid = r.get('correspondenciaid')
        if not cid:
            continue
        candidatos.add(cid)
        adpr = r.get('Documentos ADPRO')
        if adpr:
            cid_to_adpro[cid] = adpr
        prov = str(r.get('proveedor') or '').strip()
        if prov:
            prov = prov.split(' - ')[0].strip()
            cid_to_proveedor[cid] = prov

    print(f'  {len(candidatos)} correspondenciaid candidatos (actividad F019/F029, sin factura, activos)')

    # Paso 2: de descriptorescorrespondencia tomar los descriptores
    #         donde Id Correspondencia = correspondenciaid de los candidatos
    desc_sgd    = api_get(token, 'sgd_dtm_descriptorescorrespondencia')
    desc_by_cid = defaultdict(dict)
    for r in desc_sgd:
        cid    = r.get('Id Correspondencia')
        nombre = str(r.get('Nombre Descriptor') or '').strip()
        valor  = str(r.get('valor') or '').strip()
        if cid in candidatos and nombre:
            desc_by_cid[cid][nombre] = valor

    # Paso 3: clasificar SINCO (tiene "Contrato de Obra") vs EK (no tiene)
    sinco_corr_ids = {}   # cid → (macro_key, no_contrato)
    ek_corr_ids    = {}   # cid → macro_key

    for cid in candidatos:
        d     = desc_by_cid.get(cid, {})
        monto = parse_val(d.get('Valores de Retegarantia', 0))
        if monto < 1:
            continue
        contrato_obra = d.get('Contrato de Obra', '').strip()
        if contrato_obra:
            # SINCO: ADPRO define el macro (fuente autoritativa); NC skid solo refina sub-proyecto
            m2 = _re.search(r'(\d{6,})', contrato_obra)
            nc = m2.group(1) if m2 else ''
            if nc:
                macro = adpro_to_macro(cid_to_adpro.get(cid)) or (nc_to_keys(nc) or [None])[0]
                if macro:
                    sinco_corr_ids[cid] = (macro, nc)
        else:
            # EK: macro desde ADPRO
            macro = adpro_to_macro(cid_to_adpro.get(cid))
            if macro:
                ek_corr_ids[cid] = macro

    print(f'  {len(sinco_corr_ids)} correspondencias Sinco válidas')
    print(f'  {len(ek_corr_ids)} correspondencias EK válidas')

    # Con Acta Sinco (agrupado por sub-proyecto derivado del No. Contrato)
    con_acta_sinco_by_key  = defaultdict(float)
    con_acta_sinco_by_nc   = defaultdict(float)   # no_contrato → monto
    con_acta_sinco_rows_by_key = defaultdict(list)

    for cid, (macro, nc) in sinco_corr_ids.items():
        d         = desc_by_cid.get(cid, {})
        monto     = parse_val(d.get('Valores de Retegarantia', 0))
        obra      = d.get('Obras por usuario', '')
        proveedor = cid_to_proveedor.get(cid, nc) or nc
        if monto < 1:
            continue
        # Refinar sub-proyecto usando el campo CC (Obras por usuario)
        # Solo si el CC confirma el mismo macro del ADPRO
        obra_clean = ' '.join(obra.upper().replace(' DIR ', ' ').replace(' DIR', '').split())
        keys_from_cc = cc_to_keys(obra_clean) if obra_clean else []
        if keys_from_cc and macro in keys_from_cc:
            key = next((k for k in keys_from_cc if k != macro), macro)
        else:
            key = macro
        row_sinco = {
            'acct':    'Con Acta',
            'cc':      obra,
            'tercero': proveedor,
            'nc':      nc,
            'saldo_ant': 0.0,
            'saldo':   round(monto, 2),
        }
        con_acta_sinco_by_key[key] += monto
        con_acta_sinco_rows_by_key[key].append(row_sinco)
        # Propagar a todos los ancestros (sub → padre → macro)
        for ancestor in get_ancestors(key):
            con_acta_sinco_by_key[ancestor] += monto
            con_acta_sinco_rows_by_key[ancestor].append(row_sinco)
        con_acta_sinco_by_nc[nc] += monto

    # Con Acta EK
    con_acta_ek_by_key   = defaultdict(float)
    con_acta_ek_rows_by_key = defaultdict(list)

    for cid, macro in ek_corr_ids.items():
        d        = desc_by_cid.get(cid, {})
        monto    = parse_val(d.get('Valores de Retegarantia', 0))
        nc_ek    = d.get('IC # CONTRATO EK', '')
        obra     = d.get('Obras por usuario', '')
        proveedor = cid_to_proveedor.get(cid, nc_ek) or nc_ek
        if monto < 1:
            continue
        row_ek = {
            'acct':    'Con Acta EK',
            'cc':      obra,
            'tercero': proveedor,
            'saldo_ant': 0.0,
            'saldo':   round(monto, 2),
        }
        con_acta_ek_by_key[macro] += monto
        con_acta_ek_rows_by_key[macro].append(row_ek)
        # Refinar al sub-key usando el campo CC (Obras por usuario)
        obra_clean_ek = ' '.join(obra.upper().replace(' DIR ', ' ').replace(' DIR', '').split())
        keys_from_cc_ek = cc_to_keys(obra_clean_ek) if obra_clean_ek else []
        if keys_from_cc_ek and macro in keys_from_cc_ek:
            sub_ek = next((k for k in keys_from_cc_ek if k != macro), None)
            if sub_ek:
                con_acta_ek_by_key[sub_ek] += monto
                con_acta_ek_rows_by_key[sub_ek].append(row_ek)
                # Si el sub_ek tiene ancestros intermedios (ej. mit-t5 → mit-12), agregar
                for anc_ek in get_ancestors(sub_ek):
                    if anc_ek == macro:
                        break  # ya está en el macro, no duplicar
                    con_acta_ek_by_key[anc_ek] += monto
                    con_acta_ek_rows_by_key[anc_ek].append(row_ek)

    print('  Con Acta Sinco por proyecto:')
    for k, v in sorted(con_acta_sinco_by_key.items()):
        print(f'    {k:12s}: {v:>16,.0f}')
    print('  Con Acta EK por proyecto:')
    for k, v in sorted(con_acta_ek_by_key.items()):
        print(f'    {k:12s}: {v:>16,.0f}')

    # ── Fallback: si SINCO no devolvió candidatos, usar valores previos ─────────
    if len(candidatos) == 0:
        dest_path = os.path.normpath(DEST)
        if os.path.exists(dest_path):
            try:
                with open(dest_path, 'rb') as _f:
                    _raw = _f.read()
                if _raw.startswith(b'\xef\xbb\xbf'):
                    _raw = _raw[3:]
                _prev = json.loads(_raw)
                _prev_data = _prev.get('data', {})
                _count = 0
                for _k, _proj in _prev_data.items():
                    if not isinstance(_proj, dict):
                        continue
                    _t = _proj.get('totals', {})
                    _ca   = _t.get('con_acta', 0) or 0
                    _ca_ek = _t.get('con_acta_ek', 0) or 0
                    if _ca:
                        con_acta_sinco_by_key[_k] = _ca
                        _count += 1
                    if _ca_ek:
                        con_acta_ek_by_key[_k] = _ca_ek
                        _count += 1
                prev_corte = _prev.get('corte', '?')
                print(f'  FALLBACK: sgd_dtm_estadofacturas sin datos — usando Con Acta de corte anterior ({prev_corte}), {_count} entradas restauradas')
            except Exception as _e:
                print(f'  FALLBACK ERROR: no se pudo leer balance_data.json previo: {_e}')
        else:
            print('  FALLBACK: no hay balance_data.json previo para recuperar Con Acta')

    # ── 3. Construir resultado ─────────────────────────────────────────────────
    print('\n[3/4] Construyendo balance_data.json...')

    MESES_ES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    corte = f'{hoy.day} {MESES_ES[hoy.month]} {hoy.year}'

    result = {}
    all_keys = set(by_key.keys()) | set(liq_by_key.keys())

    for key in sorted(all_keys):
        cats = by_key.get(key, {})

        def tot_cat(cat):
            return round(sum(cats.get(cat, {}).values()), 2)

        ant_prov = tot_cat('Anticipo Proveedores')
        ant_cont = tot_cat('Ant. Contratistas')
        dev_ret  = tot_cat('Dev. Ret. Garantía')
        gar_cum  = tot_cat('Gta. Cumplimiento')
        liq         = round(liq_by_key.get(key, 0), 2)
        liq_ant     = round(liq_ant_by_key.get(key, 0), 2)
        con_acta    = round(con_acta_sinco_by_key.get(key, 0), 2)
        con_acta_ek = round(con_acta_ek_by_key.get(key, 0), 2)
        liquidado   = round(liq_sal_by_key.get(key, 0) + liq_mov_by_key.get(key, 0), 2)
        completado  = round(comp_sal_by_key.get(key, 0) + comp_cred_by_key.get(key, 0), 2)

        # Filas de detalle: una fila por (cat, cc, tercero)
        all_rows = []
        for cat, cc_nit_map in cats.items():
            for (cc_desc, nit), saldo in cc_nit_map.items():
                saldo = round(saldo, 2)
                if abs(saldo) < 1:
                    continue
                all_rows.append({
                    'acct':      cat,
                    'cc':        cc_desc,
                    'tercero':   nit_nombre.get(nit, nit),
                    'saldo_ant': 0.0,
                    'saldo':     saldo,
                })

        gta_pag_rows = [
            {
                'acct':    'Gta. Pagadas',
                'cc':      '',
                'tercero': nit_nombre.get(nit, nit),
                'saldo_ant': 0.0,
                'saldo':   round(monto, 2),
            }
            for nit, monto in gta_pag_by_key.get(key, {}).items()
            if monto >= 1
        ]

        sinco_rows = con_acta_sinco_rows_by_key.get(key, [])
        ek_rows    = con_acta_ek_rows_by_key.get(key, [])
        result[key] = {
            'totals': {
                'ant_prov':    ant_prov,  'ant_prov_ant': 0,
                'ant_cont':    ant_cont,  'ant_cont_ant': 0,
                'dev_ret':     dev_ret,   'dev_ret_ant':  0,
                'gar_cum':     gar_cum,   'gar_cum_ant':  0,
                'liq':         liq,       'liq_ant':      liq_ant,
                'con_acta':    con_acta,
                'con_acta_ek': con_acta_ek,
                'liquidado':   liquidado,
                'completado':  completado,
            },
            'rows': all_rows + sinco_rows + ek_rows + gta_pag_rows,
        }

        if gar_cum > 0 or ant_cont > 0 or con_acta > 0 or con_acta_ek > 0:
            print(f'  {key:12s}: gar_cum={gar_cum:>16,.0f}  ant_cont={ant_cont:>16,.0f}  con_acta={con_acta:>14,.0f}  ek={con_acta_ek:>14,.0f}')

    # ── Escribir JSON ─────────────────────────────────────────────────────────
    if not result:
        print('\nERROR — Sin datos (API no disponible). No se sobreescribe el archivo existente.')
        return

    ts = datetime.datetime.now().strftime('%d %b %Y %H:%M')
    output = {'corte': corte, 'generated_at': ts, 'data': result}
    dest_path = os.path.normpath(DEST)
    with open(dest_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

    print(f'\nOK — balance_data.json generado | {len(result)} proyectos | Corte: {corte}')
    print(f'    → {dest_path}')

if __name__ == '__main__':
    main()
