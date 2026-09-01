"""
gen_consumido_api.py  – Genera consumido_data.json desde API Sinco
==================================================================
Reemplaza gen_consumido.py (Excel) usando adp_dtm_fact_controlproyecto.

Tablas usadas:
  adp_dtm_dim_clase_origen         → clase consumido (C/J)
  adp_dtm_dim_capitulopresupuesto  → prefijo CDD/CID51-55
  adp_dtm_dim_proyecto             → skidproyecto → proyecto
  adp_dtm_fact_controlproyecto     → valores consumidos por mes/capitulo

Salida: control-costos/public/data/consumido_data.json
  {
    "corte": "31 May 2026",
    "data":    { key: [{label, cdd, cid}, ...] }  (últimos N_CHART meses)
    "detalle": { key: [{label, cid51, cid52, cid53, cid54, cid_int}, ...] }  (últimos N_DET meses)
  }

Autenticación: Azure AD device code flow; token cacheado en token_cache.json.
"""

import sys, os, json, time, datetime, calendar
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

try:
    import msal
except ImportError:
    os.system(f'{sys.executable} -m pip install msal -q')
    import msal

try:
    import requests
except ImportError:
    os.system(f'{sys.executable} -m pip install requests -q')
    import requests

# ── Config ──────────────────────────────────────────────────────────────────────
CLIENT_ID = '1da0f9dd-cc35-489c-937b-c66387864730'
TENANT_ID = '129cb8aa-2444-49b4-acc9-3f6a696f1ff0'
SCOPE     = ['api://1da0f9dd-cc35-489c-937b-c66387864730/access_as_user']
API_BASE  = 'https://api.icconstructora.co/api/sinco/data'

BASE    = os.path.dirname(os.path.abspath(__file__))
CACHE_F = os.path.join(BASE, 'token_cache.json')
_out_dir = os.environ.get('OUTPUT_DIR') or os.path.join(BASE, '..', 'control-costos', 'public', 'data')
DEST    = os.path.join(_out_dir, 'consumido_data.json')

N_CHART = 12   # meses en el gráfico (cdd + cid)
N_DET   = 4    # meses en el detalle de conceptos

MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

# ── Mapeo skidproyecto → clave sub-proyecto ──────────────────────────────────────
SUBS = {
    # MITIKA
    184: 'mit-11', 185: 'mit-11', 186: 'mit-11',
    187: 'mit-t6', 188: 'mit-t7', 189: 'mit-t6',
    337: 'mit-t7', 408: 'mit-t5', 409: 'mit-t5',
    # AZUL TURQUESA
    167: 'azt-e2', 168: 'azt-e1', 169: 'azt-e2',
    # AZUL CELESTE
    173: 'azc-e2', 174: 'azc-e1', 175: 'azc-e2', 176: 'azc-e3',
    # CASTILLA IMPERIAL
    193: 'cai-zc', 195: 'cai-e2b', 201: 'cai-e2b',
    # PRIMERA ESTE
    119: 'pri-zc', 121: 'pri-e12', 125: 'pri-e12',
    # RESERVA DE OPORTO
    116: 'opo-e12', 117: 'opo-e12', 118: 'opo-e3', 401: 'opo-e3',
    # VERDE VIVO
    179: 'ver-e2', 180: 'ver-e1', 181: 'ver-e2', 182: 'ver-e3',
    # PRAIA NATURA
    101: 'pra-zc', 103: 'pra-e1', 105: 'pra-e1', 108: 'pra-e2', 344: 'pra-e2',
    # LA HACIENDA
    131: 'hac-e1', 133: 'hac-e1', 139: 'hac-e3', 457: 'hac-ref',
    # GAIA
    160: 'gaia', 162: 'gaia',
    # BOSQUE CENTRAL
    147: 'bosque', 143: 'bosque',
    # CASTILLA LIVING
    155: 'cast-l', 157: 'cast-l',
    # WELL
    190: 'well', 192: 'well',
}

# Claves agregadas (macro) = suma de sus sub-claves
COMBOS = {
    'praia':    ['pra-e1', 'pra-e2', 'pra-zc'],
    'oporto':   ['opo-e12', 'opo-e3'],
    'primera':  ['pri-e12', 'pri-zc'],
    'hacienda': ['hac-e1', 'hac-e3', 'hac-ref'],
    'azul-t':   ['azt-e1', 'azt-e2'],
    'azul-c':   ['azc-e1', 'azc-e2', 'azc-e3'],
    'verde':    ['ver-e1', 'ver-e2', 'ver-e3'],
    'mit-12':   ['mit-t5', 'mit-t6', 'mit-t7'],
    'mitika':   ['mit-11', 'mit-t5', 'mit-t6', 'mit-t7'],
    'cast-i':   ['cai-e2b', 'cai-zc'],
}

# Todas las claves que se exportan al JSON
ALL_KEYS = [
    'praia', 'pra-e1', 'pra-e2',
    'oporto', 'opo-e12', 'opo-e3',
    'primera', 'pri-e12',
    'hacienda', 'hac-e1',
    'bosque', 'cast-l', 'gaia',
    'azul-t', 'azt-e1', 'azt-e2',
    'azul-c', 'azc-e1', 'azc-e2', 'azc-e3',
    'verde', 'ver-e1', 'ver-e2', 'ver-e3',
    'mitika', 'mit-11', 'mit-12', 'mit-t5', 'mit-t6', 'mit-t7',
    'well', 'cast-i', 'cai-e2b',
]

CID_KEYS = ['cid51', 'cid52', 'cid53', 'cid54', 'cid_int']

# ── Autenticación ───────────────────────────────────────────────────────────────
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
        cache.deserialize(open(CACHE_F).read())

    app = msal.PublicClientApplication(
        CLIENT_ID,
        authority=f'https://login.microsoftonline.com/{TENANT_ID}',
        token_cache=cache,
    )

    accounts = app.get_accounts()
    result = None
    if accounts:
        result = app.acquire_token_silent(SCOPE, account=accounts[0])

    if not result:
        flow = app.initiate_device_flow(scopes=SCOPE)
        if 'user_code' not in flow:
            raise RuntimeError(f'Error iniciando device flow: {flow}')
        print('\n' + '='*60)
        print('  AUTENTICACION REQUERIDA')
        print('='*60)
        print(f"  1. Abre: {flow['verification_uri']}")
        print(f"  2. Ingresa el codigo: {flow['user_code']}")
        print('='*60 + '\n')
        result = app.acquire_token_by_device_flow(flow)

    if 'access_token' not in result:
        raise RuntimeError(f"No se pudo obtener token: {result.get('error_description', result)}")

    if cache.has_state_changed:
        open(CACHE_F, 'w').write(cache.serialize())

    return result['access_token']

# ── API ─────────────────────────────────────────────────────────────────────────
def api_get(token, tabla, reintentos=3):
    url = f'{API_BASE}/{tabla}'
    headers = {'Authorization': f'Bearer {token}'}
    for intento in range(reintentos):
        try:
            r = requests.get(url, headers=headers, timeout=300, stream=True)
            if not r.ok:
                print(f'  WARN {tabla} HTTP {r.status_code} (intento {intento+1})')
                if intento < reintentos - 1:
                    time.sleep(5 * (intento + 1))
                    continue
                return []
            chunks = []
            for chunk in r.iter_content(chunk_size=1024*1024):
                if chunk:
                    chunks.append(chunk)
            data = json.loads(b''.join(chunks))
            return data if isinstance(data, list) else []
        except Exception as e:
            print(f'  WARN {tabla} intento {intento+1}: {e}')
            if intento < reintentos - 1:
                time.sleep(5 * (intento + 1))
    return []

def api_get_paged(token, tabla, page_size=2000, reintentos=5):
    """Descarga tabla grande. Si la API devuelve todo de una vez, lo detecta y para."""
    url = f'{API_BASE}/{tabla}'
    headers = {'Authorization': f'Bearer {token}'}
    all_rows = []
    skip = 0
    while True:
        for intento in range(reintentos):
            try:
                r = requests.get(url, headers=headers,
                    params={'$top': page_size, '$skip': skip},
                    timeout=600, stream=True)
                if not r.ok:
                    print(f'  WARN {tabla} skip={skip} HTTP {r.status_code} (intento {intento+1})')
                    if intento < reintentos - 1:
                        time.sleep(15 * (intento + 1)); continue
                    return all_rows
                chunks = []
                for chunk in r.iter_content(chunk_size=1024*1024):
                    if chunk: chunks.append(chunk)
                batch = json.loads(b''.join(chunks))
                if not isinstance(batch, list): return all_rows
                all_rows.extend(batch)
                print(f'    skip={skip:,} → +{len(batch):,} filas (total={len(all_rows):,})')
                # Si devuelve != page_size: última página O la API no soporta paginación
                if len(batch) != page_size: return all_rows
                skip += page_size
                break
            except Exception as e:
                print(f'  WARN {tabla} skip={skip} intento {intento+1}: {e}')
                if intento < reintentos - 1:
                    time.sleep(15 * (intento + 1))
                else:
                    return all_rows
    return all_rows

# ── Dimensiones ─────────────────────────────────────────────────────────────────
def build_clase_map(rows):
    """skidclaseorigen → 'consumido' | otro"""
    m = {}
    for r in rows:
        c = (r.get('clase') or '').upper()
        m[r['skidclaseorigen']] = 'consumido' if c in ('C', 'J') else 'otro'
    return m

def build_cap_map(rows):
    """skidcapitulo → cid_key: 'cdd' | 'cid51' | 'cid52' | 'cid53' | 'cid54' | 'cid_int' | None"""
    m = {}
    for r in rows:
        num = (r.get('Capitulo Numero') or '').strip().upper()
        if not num:
            continue
        if num.startswith('CDD') and not num.startswith('CDD99'):
            cid_key = 'cdd'
        elif num.startswith('CID51') or num == 'CID':
            cid_key = 'cid51'
        elif num.startswith('CID52'):
            cid_key = 'cid52'
        elif num.startswith('CID53'):
            cid_key = 'cid53'
        elif num.startswith('CID54'):
            cid_key = 'cid54'
        elif num.startswith('CID55') or num.startswith('CID56'):
            cid_key = 'cid_int'
        else:
            continue  # CDD99, CF*, 0*, etc. → excluir
        m[r['skidcapitulo']] = cid_key
    return m

def build_proj_map(rows):
    """skidproyecto → sub-clave usando SUBS (código = skidproyecto - 100000)"""
    m = {}
    for r in rows:
        skid = r.get('skidproyecto')
        if not skid:
            continue
        codigo = int(skid) - 100000
        key = SUBS.get(codigo)
        if key:
            m[int(skid)] = key
    return m

# ── Helpers ──────────────────────────────────────────────────────────────────────
def prev_month(yr, mo):
    return (yr, mo - 1) if mo > 1 else (yr - 1, 12)

def mes_label(yr, mo):
    return f'{MESES[mo]} {str(yr)[2:]}'

def zero_record():
    return {'cdd': 0.0, 'cid51': 0.0, 'cid52': 0.0, 'cid53': 0.0, 'cid54': 0.0, 'cid_int': 0.0}

# ── Acumulador (sub-claves atómicas, no COMBOS) ─────────────────────────────────
def accumulate(fact_rows, clase_map, cap_map, proj_map):
    """Acumula consumido por (sub_key, yr, mo, cid_key)"""
    acc = defaultdict(lambda: defaultdict(zero_record))
    for r in fact_rows:
        if clase_map.get(r.get('skidclaseorigen')) != 'consumido':
            continue
        cid_key = cap_map.get(r.get('skidcapitulo'))
        if not cid_key:
            continue
        proj_key = proj_map.get(r.get('skidproyecto'))
        if not proj_key:
            continue
        fecha = str(r.get('skidfecha') or '')
        if len(fecha) < 6:
            continue
        try:
            yr, mo = int(fecha[:4]), int(fecha[4:6])
        except ValueError:
            continue
        val = float(r.get('Valor Total') or 0)
        acc[proj_key][(yr, mo)][cid_key] += val

    return acc

# ── Combinar sub-claves en macros ───────────────────────────────────────────────
def build_all(acc):
    """Agrega sub-claves base + compone COMBOS"""
    result = {}

    # Primero copia sub-claves atómicas
    for key, months in acc.items():
        result[key] = {ym: dict(v) for ym, v in months.items()}

    # Luego construye COMBOS
    for combo_key, parts in COMBOS.items():
        merged = defaultdict(zero_record)
        for part in parts:
            for ym, vals in result.get(part, {}).items():
                for k, v in vals.items():
                    merged[ym][k] += v
        if merged:
            result[combo_key] = {ym: dict(v) for ym, v in merged.items()}

    return result

# ── Rango de meses ───────────────────────────────────────────────────────────────
def month_range(global_max, n):
    months = []
    ym = global_max
    for _ in range(n):
        months.insert(0, ym)
        ym = prev_month(*ym)
    return months

# ── Main ─────────────────────────────────────────────────────────────────────────
print('='*60)
print('  IC CONSTRUCTORA - gen_consumido_api.py')
print('  Fuente: API datamart Sinco')
print('='*60)

token = get_token()
print('Token OK\n')

print('[1/3] Cargando dimensiones...')
clase_rows = api_get(token, 'adp_dtm_dim_controlclaseorigen')
print(f'  clase_origen: {len(clase_rows)} filas')
cap_rows   = api_get(token, 'adp_dtm_dim_capitulopresupuesto')
print(f'  capitulopresupuesto: {len(cap_rows)} filas')
proj_rows  = api_get(token, 'adp_dtm_dim_proyecto')
print(f'  dim_proyecto: {len(proj_rows)} filas')

clase_map = build_clase_map(clase_rows)
cap_map   = build_cap_map(cap_rows)
proj_map  = build_proj_map(proj_rows)

print(f'\n[2/3] Descargando fact_controlproyecto (paginado 2000/página)...')
fact_rows = api_get_paged(token, 'adp_dtm_fact_controlproyecto')
print(f'  Total: {len(fact_rows):,} filas')

if not fact_rows:
    print('\n❌ ERROR — fact_controlproyecto devolvió 0 filas (probable 504/timeout).')
    print('No se sobrescribe consumido_data.json. Se conservan los datos previos.')
    sys.exit(1)

print('  Acumulando...')
acc = accumulate(fact_rows, clase_map, cap_map, proj_map)
all_data = build_all(acc)

print(f'  {len(all_data)} claves de proyecto\n')

print('[3/3] Construyendo JSON...')

# Corte = último mes CERRADO (mes anterior al actual)
hoy = datetime.date.today()
if hoy.month == 1:
    corte_max = (hoy.year - 1, 12)
else:
    corte_max = (hoy.year, hoy.month - 1)

# Máximo real en los datos — evita mostrar meses vacíos cuando la API tiene rezago
data_max = None
for months in all_data.values():
    for ym in months:
        if data_max is None or ym > data_max:
            data_max = ym

# El extremo del rango es el menor entre el mes cerrado y el máximo real en datos
global_max = min(corte_max, data_max) if data_max else corte_max
print(f'  Corte calendario: {mes_label(*corte_max)} | Máximo en datos: {mes_label(*data_max) if data_max else "—"} | Usando: {mes_label(*global_max)}')

yr_c, mo_c = global_max
ultimo_dia  = calendar.monthrange(yr_c, mo_c)[1]
corte_str   = f'{ultimo_dia} {MESES[mo_c]} {yr_c}'
print(f'  Mes más reciente global: {mes_label(*global_max)}  ({corte_str})')

chart_range = month_range(global_max, N_CHART)
det_range   = month_range(global_max, N_DET)

out_data    = {}
out_detalle = {}

for key in ALL_KEYS:
    months = all_data.get(key, {})

    # gráfico: [{label, cdd, cid}]
    chart_rows = []
    for ym in chart_range:
        v = months.get(ym, {})
        cdd = v.get('cdd', 0)
        cid = sum(v.get(k, 0) for k in CID_KEYS)
        chart_rows.append({'label': mes_label(*ym), 'cdd': round(cdd), 'cid': round(cid)})
    out_data[key] = chart_rows

    # detalle: [{label, cid51, cid52, cid53, cid54, cid_int}]
    det_rows = []
    for ym in det_range:
        v = months.get(ym, {})
        det_rows.append({
            'label':   mes_label(*ym),
            'cid51':   round(v.get('cid51',   0)),
            'cid52':   round(v.get('cid52',   0)),
            'cid53':   round(v.get('cid53',   0)),
            'cid54':   round(v.get('cid54',   0)),
            'cid_int': round(v.get('cid_int', 0)),
        })
    out_detalle[key] = det_rows

    last_nz = next((r for r in reversed(chart_rows) if r['cdd'] > 0), None)
    if last_nz:
        cid_total = sum(r['cid'] for r in chart_rows[-N_DET:])
        print(f'  {key:12s}: último CDD {last_nz["label"]}  '
              f'CDD={last_nz["cdd"]:>14,.0f}  CID3m={cid_total:>12,.0f}')
    else:
        print(f'  {key:12s}: sin datos')

output = {
    'corte':        corte_str,
    'generated_at': datetime.datetime.now().strftime('%d %b %Y %H:%M'),
    'data':         out_data,
    'detalle':      out_detalle,
}

os.makedirs(os.path.dirname(DEST), exist_ok=True)
# Backup del archivo anterior antes de sobrescribir
dest_path = os.path.normpath(DEST)
bak_path  = dest_path + '.bak'
if os.path.exists(dest_path):
    import shutil
    shutil.copy2(dest_path, bak_path)
with open(dest_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

print(f'\nOK - consumido_data.json → {DEST}')
print('='*60)
print('  COMPLETADO - Recarga el navegador con Ctrl+Shift+R')
print('='*60)
