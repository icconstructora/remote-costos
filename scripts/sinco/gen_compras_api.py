"""
gen_compras_api.py – Genera compras_data.json desde API Sinco
=============================================================
Tabla: adp_dtm_fact_compras
Estados: adp_dtm_dim_estadopordocumento (Tipo_Documento = COMPRAS)

Salida: control-costos/public/data/compras_data.json
  {
    "generated_at": "13 Ago 2026 07:00",
    "data": {
      "<key>": {
        "estados": {
          "Generada":           {"n": 0, "valor": 0},
          "Pre-Aprobada":       {"n": 0, "valor": 0},
          "Aprobada":           {"n": 0, "valor": 0},
          "En Proceso Entrega": {"n": 0, "valor": 0},
          "Completada":         {"n": 0, "valor": 0},
          "Cerrada":            {"n": 0, "valor": 0},
          "Cancelada":          {"n": 0, "valor": 0},
          "Anulada":            {"n": 0, "valor": 0}
        },
        "total_n":      0,
        "total_valor":  0,
        "activas_n":    0,   # Pre-Aprobada + Aprobada + En Proceso + Generada
        "activas_valor":0
      }
    }
  }

Autenticación: Azure AD device code flow; token cacheado en token_cache.json.
"""

import sys, os, json, datetime
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
DEST    = os.path.join(_out_dir, 'compras_data.json')

# ── Estados de compras ───────────────────────────────────────────────────────────
ESTADOS = {
    10020: 'Generada',
    10027: 'Pre-Aprobada',
    10021: 'Aprobada',
    10022: 'En Proceso Entrega',
    10023: 'Completada',
    10024: 'Cerrada',
    10025: 'Cancelada',
    10026: 'Anulada',
}

# Estados que cuentan como "activas" (pendientes de cierre)
ACTIVAS = {10020, 10021, 10022}   # Generada, Aprobada, En Proceso Entrega

ESTADO_ORDEN = ['Generada','Pre-Aprobada','Aprobada','En Proceso Entrega',
                 'Completada','Cerrada','Cancelada','Anulada']

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
    119: 'pri-zc', 121: 'pri-e12', 125: 'pri-e12', 400: 'primera',
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

# ── Auth ─────────────────────────────────────────────────────────────────────────
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
        token_cache=cache
    )
    accounts = app.get_accounts()
    result = app.acquire_token_silent(SCOPE, account=accounts[0]) if accounts else None
    if not result:
        flow = app.initiate_device_flow(scopes=SCOPE)
        print(flow['message'], flush=True)
        result = app.acquire_token_by_device_flow(flow)
    if cache.has_state_changed:
        open(CACHE_F, 'w').write(cache.serialize())
    return result['access_token']

def api_get(token, table, timeout=120):
    r = requests.get(
        f'{API_BASE}/{table}',
        headers={'Authorization': f'Bearer {token}'},
        timeout=timeout
    )
    r.raise_for_status()
    return r.json()

# ── Acumulador vacío por key ──────────────────────────────────────────────────────
def empty_bucket():
    return {est: {'n': 0, 'valor': 0.0} for est in ESTADO_ORDEN}

# ── Formateo de fecha YYYYMMDD → 'DD/MM/YYYY' ────────────────────────────────────
def fmt_fecha(v):
    s = str(v or '')
    if len(s) == 8 and s.isdigit() and s[:4] not in ('1900', '0000'):
        return f'{s[6:8]}/{s[4:6]}/{s[:4]}'
    return ''

# ── Main ─────────────────────────────────────────────────────────────────────────
def main():
    print('Autenticando…', flush=True)
    token = get_token()

    # Terceros: skidtercero → nombre
    print('Descargando adp_dtm_dim_tercero…', flush=True)
    ter_rows = api_get(token, 'adp_dtm_dim_tercero', timeout=300)
    nombre_by_tercero = {r['skidtercero']: r.get('nombre', '') for r in ter_rows if 'skidtercero' in r}
    print(f'  {len(nombre_by_tercero)} terceros', flush=True)

    # Entradas de almacén: agrupar por Compra Numero
    print('Descargando adp_dtm_fact_entradasalmacen…', flush=True)
    ent_rows = api_get(token, 'adp_dtm_fact_entradasalmacen', timeout=600)
    print(f'  {len(ent_rows)} entradas', flush=True)
    ult_fecha_ent   = {}   # compra_no → max skidfechaentrada (int YYYYMMDD)
    total_entregado = {}   # compra_no → sum Total Entrada
    for e in ent_rows:
        cn = e.get('Compra Numero')
        if cn is None:
            continue
        cn = int(cn)
        fe = int(e.get('skidfechaentrada') or 0)
        te = float(e.get('Total Entrada') or 0)
        if fe > ult_fecha_ent.get(cn, 0):
            ult_fecha_ent[cn] = fe
        total_entregado[cn] = total_entregado.get(cn, 0.0) + te

    print('Descargando adp_dtm_fact_compras…', flush=True)
    rows = api_get(token, 'adp_dtm_fact_compras')
    print(f'  {len(rows)} registros', flush=True)

    hoy_date = datetime.date.today()

    # Agrupar ítems por orden (Compra No) — una fila por orden
    orden_data = defaultdict(dict)   # sub → {compra_no: orden_dict}
    buckets    = defaultdict(empty_bucket)

    for r in rows:
        skid_proj = r.get('skidproyecto')
        if skid_proj is None:
            continue
        proj_num = skid_proj % 100000 if skid_proj > 100000 else skid_proj
        sub = SUBS.get(proj_num)
        if not sub:
            continue

        estado_id = r.get('skidestado')
        est_label = ESTADOS.get(estado_id)
        if not est_label:
            continue

        compra_no = int(r.get('Compra No') or 0)
        valor     = float(r.get('Valor Total') or 0)

        if compra_no not in orden_data[sub]:
            orden_data[sub][compra_no] = {
                'compra_no':   compra_no,
                'estado':      est_label,
                'skidtercero': r.get('skidtercero'),
                'fecha_compra': int(r.get('skidfechacompra') or 0),
                'valor_compra': 0.0,
            }
            buckets[sub][est_label]['n'] += 1

        orden_data[sub][compra_no]['valor_compra'] += valor
        buckets[sub][est_label]['valor'] += valor

    # Construir combos
    for macro, subs_list in COMBOS.items():
        b = empty_bucket()
        for s in subs_list:
            if s in buckets:
                for est in ESTADO_ORDEN:
                    b[est]['n']     += buckets[s][est]['n']
                    b[est]['valor'] += buckets[s][est]['valor']
                for compra_no, od in orden_data.get(s, {}).items():
                    if compra_no not in orden_data[macro]:
                        orden_data[macro][compra_no] = od
        buckets[macro] = b

    def build_rows(sub):
        result = []
        for od in orden_data.get(sub, {}).values():
            compra_no = od['compra_no']
            fe_int    = ult_fecha_ent.get(compra_no, 0)
            fe_str    = fmt_fecha(fe_int)
            if fe_int and str(fe_int)[:4] not in ('1900', '0000'):
                fe_date = datetime.date(fe_int // 10000, (fe_int % 10000) // 100, fe_int % 100)
                dias    = (hoy_date - fe_date).days
            else:
                dias   = None
                fe_str = ''
            entregado = total_entregado.get(compra_no, 0.0)
            saldo     = round(od['valor_compra'] - entregado, 2)
            result.append({
                'compra_no':            compra_no,
                'proveedor':            nombre_by_tercero.get(od['skidtercero'], ''),
                'fecha_compra':         fmt_fecha(od['fecha_compra']),
                'fecha_ultima_entrada': fe_str,
                'dias_sin_entrada':     dias,
                'estado':               od['estado'],
                'valor_compra':         round(od['valor_compra'], 2),
                'saldo_por_entregar':   saldo,
            })
        result.sort(key=lambda x: x['compra_no'])
        return result

    # Construir output
    data = {}
    for key in ALL_KEYS:
        b = buckets.get(key, empty_bucket())
        total_n     = sum(b[e]['n']     for e in ESTADO_ORDEN)
        total_valor = sum(b[e]['valor'] for e in ESTADO_ORDEN)
        activas_n     = sum(b[ESTADOS[sid]]['n']     for sid in ACTIVAS if ESTADOS[sid] in b)
        activas_valor = sum(b[ESTADOS[sid]]['valor'] for sid in ACTIVAS if ESTADOS[sid] in b)
        data[key] = {
            'estados':       b,
            'total_n':       total_n,
            'total_valor':   round(total_valor, 2),
            'activas_n':     activas_n,
            'activas_valor': round(activas_valor, 2),
            'rows':          build_rows(key),
        }

    hoy = datetime.datetime.now()
    out = {
        'generated_at': hoy.strftime('%d %b %Y %H:%M'),
        'data': data,
    }

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    with open(DEST, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

    print(f'Guardado en: {DEST}', flush=True)

if __name__ == '__main__':
    main()
