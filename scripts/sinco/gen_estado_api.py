"""
gen_estado_api.py  – Genera estado_detalle_data.js + estado_resumen.js
=======================================================================
Consulta directamente las tablas del datamart Sinco (API REST) sin necesitar
archivos Excel intermedios.

Tablas usadas:
  adp_dtm_dim_proyecto              → lista de proyectos y skids
  adp_dtm_dim_controlclaseorigen    → clasificacion P/Y/B-T/C-J
  adp_dtm_dim_capitulopresupuesto   → descripcion y tipo (cdd/cid) por capitulo
  adp_dtm_fact_controlproyecto      → valores presupuesto/proyectado/asegurado/consumido

Autenticacion: Azure AD device code flow (abre navegador una sola vez).
El token se cachea en token_cache.json para sesiones siguientes.

Uso: python gen_estado_api.py
"""

import sys, os, json, re, time, math, datetime
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Dependencias ───────────────────────────────────────────────────────────────
try:
    import msal
except ImportError:
    print("Instalando msal..."); os.system(f"{sys.executable} -m pip install msal -q")
    import msal

try:
    import requests
except ImportError:
    print("Instalando requests..."); os.system(f"{sys.executable} -m pip install requests -q")
    import requests

# ── Configuracion ──────────────────────────────────────────────────────────────
CLIENT_ID = '1da0f9dd-cc35-489c-937b-c66387864730'
TENANT_ID = '129cb8aa-2444-49b4-acc9-3f6a696f1ff0'
SCOPE     = ['api://1da0f9dd-cc35-489c-937b-c66387864730/access_as_user']
API_BASE  = 'https://api.icconstructora.co/api/sinco/data'

BASE     = os.path.dirname(os.path.abspath(__file__))
DEST_DET = os.path.join(BASE, 'estado_detalle_data.js')
DEST_RES = os.path.join(BASE, 'estado_resumen.js')
_out_dir      = os.environ.get('OUTPUT_DIR') or os.path.join(BASE, '..', 'control-costos', 'public', 'data')
DEST_DET_JSON = os.path.join(_out_dir, 'estado_detalle_data.json')
CACHE_F  = os.path.join(BASE, 'token_cache.json')

UMBRAL = 0.70  # limite critico por asegurar

# ── Macroproyectos ─────────────────────────────────────────────────────────────
MACRO_KEYS = {
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

# Mapeo codigo de proyecto (skidproyecto - 100000) → clave JS sub-proyecto
# Los que apuntan al macro se fusionan con el total
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
    179: 'ver-e2', 180: 'ver-e1',  181: 'ver-e2',  182: 'ver-e3',
    # PRAIA NATURA
    101: 'pra-zc', 103: 'pra-e1', 105: 'pra-e1',  108: 'pra-e2', 344: 'pra-e2',
    # LA HACIENDA
    131: 'hac-e1', 133: 'hac-e1', 139: 'hac-e3', 457: 'hac-ref',
    # GAIA (proyecto único — DIR + nómina van al macro)
    160: 'gaia',   162: 'gaia',
    # BOSQUE CENTRAL
    147: 'bosque', 143: 'bosque',
    # CASTILLA LIVING
    155: 'cast-l', 157: 'cast-l',
    # WELL
    190: 'well',   192: 'well',
}

# Claves agregadas que son suma de otras claves
COMBOS = {
    'mit-12': ['mit-t5', 'mit-t6', 'mit-t7'],
}

# Sub-proyectos cuyo PRESUPUESTO se excluye al sumar (no tienen presupuesto propio)
NO_PPTO_KEYS = {'hac-ref'}

# ── Autenticacion ──────────────────────────────────────────────────────────────
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

    # Intentar token silencioso desde cache
    accounts = app.get_accounts()
    result = None
    if accounts:
        result = app.acquire_token_silent(SCOPE, account=accounts[0])

    if not result:
        # Device code flow
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

    # Guardar cache
    if cache.has_state_changed:
        open(CACHE_F, 'w').write(cache.serialize())

    return result['access_token']

# ── Llamadas API ───────────────────────────────────────────────────────────────
def api_get_page(token, url, headers, params, page_size=2000, reintentos=5):
    """Descarga una tabla paginando con $top/$skip hasta agotar filas."""
    all_rows = []
    skip = 0
    while True:
        p = dict(params or {})
        p['$top']  = page_size
        p['$skip'] = skip
        for intento in range(reintentos):
            try:
                r = requests.get(url, headers=headers, params=p, timeout=300, stream=True)
                if not r.ok:
                    print(f'  WARN página skip={skip} HTTP {r.status_code} (intento {intento+1})')
                    if intento < reintentos - 1:
                        time.sleep(15 * (intento + 1))
                        continue
                    return all_rows  # devolver lo que tenemos
                chunks = []
                for chunk in r.iter_content(chunk_size=1024*1024):
                    if chunk:
                        chunks.append(chunk)
                batch = json.loads(b''.join(chunks))
                if not isinstance(batch, list):
                    return all_rows
                all_rows.extend(batch)
                print(f'    skip={skip:,} → +{len(batch):,} filas (total={len(all_rows):,})')
                # Si devuelve != page_size: última página O API no soporta paginación
                if len(batch) != page_size:
                    return all_rows
                skip += page_size
                break  # siguiente página
            except Exception as e:
                print(f'  WARN página skip={skip} intento {intento+1}: {e}')
                if intento < reintentos - 1:
                    time.sleep(15 * (intento + 1))
                else:
                    return all_rows
    return all_rows

def api_get(token, tabla, params=None, reintentos=5):
    url = f'{API_BASE}/{tabla}'
    headers = {'Authorization': f'Bearer {token}'}
    for intento in range(reintentos):
        try:
            r = requests.get(url, headers=headers, params=params or {},
                             timeout=300, stream=True)
            if not r.ok:
                print(f'  WARN {tabla} HTTP {r.status_code} (intento {intento+1})')
                if intento < reintentos - 1:
                    time.sleep(15 * (intento + 1))
                    continue
                return []
            chunks = []
            for chunk in r.iter_content(chunk_size=1024*1024):
                if chunk:
                    chunks.append(chunk)
            content = b''.join(chunks)
            data = json.loads(content)
            return data if isinstance(data, list) else []
        except Exception as e:
            print(f'  WARN {tabla} intento {intento+1}: {e}')
            if intento < reintentos - 1:
                time.sleep(15 * (intento + 1))
    return []

def api_get_safe(token, tabla, params=None):
    try:
        return api_get(token, tabla, params)
    except Exception as e:
        print(f'  WARN {tabla}: {e}')
        return []

# ── Mapas de dimension ─────────────────────────────────────────────────────────
def build_clase_map(rows):
    m = {}
    for r in rows:
        c = (r.get('clase') or '').upper()
        m[r['skidclaseorigen']] = (
            'presupuesto' if c == 'P' else
            'proyectado'  if c == 'Y' else
            'asegurado'   if c in ('B','T') else
            'consumido'   if c in ('C','J') else 'otro'
        )
    return m

def build_cap_map(rows):
    """Clasifica capítulos por Capitulo Numero: CDD* = directo, CI*/CID* = indirecto.
    Todo lo que no empiece por CDD, CI o CID se excluye."""
    m = {}
    for r in rows:
        num = (r.get('Capitulo Numero') or '').strip().upper()
        if num.startswith('CDD'):
            is_cid = False
        elif num.startswith('CID'):
            is_cid = True
        else:
            continue  # 0, CF*, y cualquier otro — excluir
        m[r['skidcapitulo']] = {
            'desc':  r.get('Capitulo Descripcion') or f"Cap.{r['skidcapitulo']}",
            'num':   num,
            'is_cid': is_cid,
        }
    return m

# ── Corte desde skidfecha ──────────────────────────────────────────────────────
MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

def corte_hoy():
    hoy = datetime.date.today()
    return f"{hoy.day} {MESES[hoy.month]} {hoy.year}"

# ── Agregar filas de fact_controlproyecto ──────────────────────────────────────
def agregar_control(rows, clase_map, cap_map, macro_key, sub_keys_for_skid, item_map=None):
    """
    sub_keys_for_skid: dict { skidproyecto: sub_key }
    item_map: dict { skiditems_str: descripcion }
    Retorna: { clave: lista de items con subs }
    """
    acum = defaultdict(lambda: defaultdict(lambda: {
        'ppto': 0.0, 'proy': 0.0, 'aseg': 0.0, 'cons': 0.0, 'tipo': 'cdd', 'num': '',
        'subs': defaultdict(lambda: {'proy': 0.0, 'aseg': 0.0, 'desc': ''}),
    }))

    for r in rows:
        tipo_clase = clase_map.get(r.get('skidclaseorigen'))
        if not tipo_clase or tipo_clase == 'otro':
            continue

        skidcap = r.get('skidcapitulo')
        cap     = cap_map.get(skidcap)
        if not cap:
            continue

        val = r.get('Valor Total') or 0
        try:
            val = float(val)
        except (TypeError, ValueError):
            val = 0.0

        cap_desc = cap['desc']
        tipo_cap = 'cid' if cap['is_cid'] else 'cdd'
        cap_num  = cap.get('num', '')

        # Clave sub-proyecto — solo skids explícitos en SUBS
        skidproy = r.get('skidproyecto')
        code     = skidproy - 100000 if skidproy else None
        sub_key  = SUBS.get(code)
        if not sub_key:
            continue  # skid no está en el Excel de subproyectos, ignorar

        skid_item_str = str(r.get('skiditems') or '')
        item_info     = (item_map or {}).get(skid_item_str) if skid_item_str else None
        item_desc     = item_info['desc'] if item_info else ''
        item_num      = item_info['num']  if item_info else ''

        def add(key):
            entry = acum[key][cap_desc]
            entry['tipo'] = tipo_cap
            entry['num']  = cap_num
            # hac-ref: presupuesto = 0 (no tiene presupuesto propio)
            if tipo_clase == 'presupuesto' and sub_key in NO_PPTO_KEYS:
                return
            if   tipo_clase == 'presupuesto': entry['ppto'] += val
            elif tipo_clase == 'proyectado':
                entry['proy'] += val
                if skid_item_str and item_desc:
                    sub = entry['subs'][skid_item_str]
                    sub['proy'] += val
                    sub['desc'] = item_desc
                    sub['num']  = item_num
            elif tipo_clase == 'asegurado':
                entry['aseg'] += val
                if skid_item_str and item_desc:
                    sub = entry['subs'][skid_item_str]
                    sub['aseg'] += val
                    sub['desc'] = item_desc
                    sub['num']  = item_num
            elif tipo_clase == 'consumido':   entry['cons'] += val

        add(sub_key)
        if sub_key != macro_key:
            add(macro_key)

    # Convertir a lista de items
    result = {}
    for key, caps in acum.items():
        items = []
        tot = {'cdd': {'ppto':0,'proy':0,'aseg':0,'cons':0}, 'cid': {'ppto':0,'proy':0,'aseg':0,'cons':0}}
        for cap_desc, vals in caps.items():
            ppto = vals['ppto']
            proy = vals['proy']
            aseg = vals['aseg']
            cons = vals['cons']
            # Acumular totales por tipo antes del filtro PA
            t = tot['cid'] if vals['tipo'] == 'cid' else tot['cdd']
            t['ppto'] += ppto; t['proy'] += proy; t['aseg'] += aseg; t['cons'] += cons
            pa = proy - aseg
            if abs(pa) < 1:  # pa == 0 → no mostrar en detalle
                continue
            pct = (pa / proy) if proy > 0 else (1.0 if pa > 0 else 0.0)
            raw_subs = vals.get('subs') or {}
            subs_list = []
            for sid, sv in raw_subs.items():
                sub_pa = round(sv['proy'] - sv['aseg'])
                if abs(sub_pa) < 1:
                    continue
                if 0 < sub_pa <= 10000:
                    continue
                subs_list.append({
                    'desc': sv['desc'],
                    'num':  sv.get('num', ''),
                    'proy': round(sv['proy']),
                    'aseg': round(sv['aseg']),
                    'pa':   sub_pa,
                })
            subs_list.sort(key=lambda x: -abs(x['pa']))
            items.append({
                'cap':  cap_desc,
                'num':  vals.get('num', ''),
                'tipo': vals['tipo'],
                'ppto': round(ppto),
                'proy': round(proy),
                'aseg': round(aseg),
                'cons': round(cons),
                'pa':   round(pa),
                'pct':  round(pct, 4),
                'subs': subs_list,
            })
        items.sort(key=lambda x: -abs(x['pa']))
        result[key] = {
            'items': items,
            'totales': {
                'cdd': {k: round(v) for k, v in tot['cdd'].items()},
                'cid': {k: round(v) for k, v in tot['cid'].items()},
            },
        }

    return result

# ── Resumen (mismo algoritmo que gen_estado.py) ────────────────────────────────
def cap_code(desc):
    m = re.match(r'^([A-Z0-9]+)-', str(desc or ''))
    return m.group(1) if m else ''

def calcular_resumen(items):
    cdd_items = [i for i in items if i.get('tipo') != 'cid']
    cid_items = [i for i in items if i.get('tipo') == 'cid']

    cap_map = defaultdict(lambda: {'pa': 0, 'crit': 0, 'nom': ''})
    for item in cdd_items:
        cod = cap_code(item['cap'])
        pa  = item['pa']
        if not cod:
            continue
        cap_map[cod]['pa'] += pa
        cap_map[cod]['nom'] = item['cap'][len(cod)+1:].strip() if item['cap'].startswith(cod+'-') else item['cap']
        if item['pct'] > UMBRAL:
            cap_map[cod]['crit'] += pa

    top5 = [
        {'cod': cod, 'nom': d['nom'], 'pa': round(d['pa']), 'crit': round(d['crit'])}
        for cod, d in sorted(cap_map.items(), key=lambda x: -x[1]['pa'])[:5]
    ]

    gd_map = defaultdict(lambda: {'pa': 0, 'nom': ''})
    for item in cid_items:
        cod = cap_code(item['cap'])
        if not cod:
            continue
        gd_map[cod]['pa'] += item['pa']
        gd_map[cod]['nom'] = item['cap'][len(cod)+1:].strip() if item['cap'].startswith(cod+'-') else item['cap']

    gd_top5 = [
        {'cod': cod, 'nom': d['nom'], 'pa': round(d['pa'])}
        for cod, d in sorted(gd_map.items(), key=lambda x: -x[1]['pa'])[:5]
    ]

    return {
        'crit': round(sum(i['pa'] for i in cdd_items if i['pct'] > UMBRAL)),
        'otro': round(sum(i['pa'] for i in cdd_items if i['pct'] <= UMBRAL)),
        'gd':   round(sum(i['pa'] for i in cid_items)),
        'caps':    top5,
        'gd_caps': gd_top5,
    }

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print('='*60)
    print('  IC CONSTRUCTORA - gen_estado_api.py')
    print('  Fuente: API datamart Sinco')
    print('='*60)

    token = get_token()
    print('Token OK\n')

    # Dimensiones globales
    print('[1/3] Cargando dimensiones...')
    clase_rows = api_get_safe(token, 'adp_dtm_dim_controlclaseorigen')
    cap_rows   = api_get_safe(token, 'adp_dtm_dim_capitulopresupuesto')
    proy_rows  = api_get_safe(token, 'adp_dtm_dim_proyecto', {'skidempresa': 100})
    item_rows  = api_get_safe(token, 'adp_dtm_dim_items')
    print(f'  clase_origen: {len(clase_rows)} filas')
    print(f'  capitulopresupuesto: {len(cap_rows)} filas')
    print(f'  dim_proyecto: {len(proy_rows)} filas')
    print(f'  dim_items: {len(item_rows)} filas')

    clase_map = build_clase_map(clase_rows)
    cap_map   = build_cap_map(cap_rows)
    # mapa skiditems → descripcion
    item_map  = {
        str(r['skiditems']): {
            'desc': r.get('Item Descripcion') or r.get('Item No') or str(r['skiditems']),
            'num':  r.get('Item No') or '',
        }
        for r in item_rows if r.get('skiditems')
    }

    # Agrupar proyectos por macroproyecto
    by_macro = defaultdict(list)
    for r in proy_rows:
        macro_desc = (r.get('MacroProyecto Descripcion') or '').strip().upper()
        by_macro[macro_desc].append(r)

    # Encontrar clave JS para cada macro
    macros = []
    for macro_desc, rows in by_macro.items():
        key = None
        for k, v in MACRO_KEYS.items():
            if k.upper() in macro_desc:
                key = v
                break
        if not key:
            continue
        # Excluir proyectos IND del control
        control_rows_proy = [
            r for r in rows
            if ' IND ' not in (' ' + (r.get('Nombre Proyecto') or '') + ' ').upper()
        ]
        skids_control = [r['skidproyecto'] for r in control_rows_proy]
        macros.append({
            'key':   key,
            'label': rows[0].get('MacroProyecto Descripcion', macro_desc),
            'skids': skids_control,
            'rows':  control_rows_proy,
        })

    ORDER = list(MACRO_KEYS.values())
    macros.sort(key=lambda m: ORDER.index(m['key']) if m['key'] in ORDER else 99)

    # Mapeo global skidproyecto → macro_key y sub_key
    skid_to_macro   = {}   # skid → macro_key
    skid_to_sub     = {}   # skid → sub_key
    macro_skids_set = {}   # macro_key → set(skids válidos)

    for macro in macros:
        key = macro['key']
        macro_skids_set[key] = set(macro['skids'])
        for r in macro['rows']:
            sk   = r['skidproyecto']
            code = sk - 100000
            sub_key = SUBS.get(code, key)
            skid_to_macro[sk] = key
            skid_to_sub[sk]   = sub_key

    # Paginado para evitar 504 — la tabla completa supera el límite del servidor
    print(f'\n[2/3] Descargando fact_controlproyecto (paginado de 2000 en 2000)...')
    all_ctrl_rows = api_get_page(
        token,
        f'{API_BASE}/adp_dtm_fact_controlproyecto',
        {'Authorization': f'Bearer {token}'},
        params={},
        page_size=2000,
        reintentos=8,
    )
    print(f'  Total: {len(all_ctrl_rows):,} filas')

    if not all_ctrl_rows:
        print('\nERROR: la API no devolvió filas de fact_controlproyecto (probable 502/504).')
        print('No se sobrescriben estado_detalle_data.js / estado_resumen.js. Se conservan los datos previos.')
        sys.exit(1)

    corte = corte_hoy()
    detalle_data = {}
    resumen_data = {}

    # Agrupar filas por macro
    print(f'  Procesando...')
    rows_by_macro = defaultdict(list)
    for r in all_ctrl_rows:
        sk = r.get('skidproyecto')
        mk = skid_to_macro.get(sk)
        if mk:
            rows_by_macro[mk].append(r)

    # Agregar por macro
    for macro in macros:
        key   = macro['key']
        rows  = rows_by_macro.get(key, [])
        print(f'  [{key}]: {len(rows):,} filas')
        if not rows:
            continue

        resultado = agregar_control(rows, clase_map, cap_map, key, skid_to_sub, item_map)

        for sub_key, val in resultado.items():
            items   = val['items']
            totales = val['totales']
            if sub_key not in detalle_data:
                detalle_data[sub_key] = {'fechaCorte': corte, 'items': [],
                    'totales': {'cdd': {'ppto':0,'proy':0,'aseg':0,'cons':0}, 'cid': {'ppto':0,'proy':0,'aseg':0,'cons':0}}}
            detalle_data[sub_key]['items'].extend(items)
            for tipo in ('cdd', 'cid'):
                for k in ('ppto', 'proy', 'aseg', 'cons'):
                    detalle_data[sub_key]['totales'][tipo][k] += totales[tipo][k]

        # Combos
        for combo_key, sources in COMBOS.items():
            if any(s in resultado for s in sources):
                combo_items   = []
                combo_totales = {'cdd': {'ppto':0,'proy':0,'aseg':0,'cons':0}, 'cid': {'ppto':0,'proy':0,'aseg':0,'cons':0}}
                for src in sources:
                    src_entry = detalle_data.get(src, {})
                    combo_items.extend(src_entry.get('items', []))
                    for tipo in ('cdd', 'cid'):
                        for k in ('ppto', 'proy', 'aseg', 'cons'):
                            combo_totales[tipo][k] += src_entry.get('totales', {}).get(tipo, {}).get(k, 0)
                if combo_items:
                    detalle_data[combo_key] = {'fechaCorte': corte, 'items': combo_items, 'totales': combo_totales}

    # Ordenar items y calcular resumen
    for k, proj in detalle_data.items():
        proj['items'].sort(key=lambda x: -abs(x['pa']))
        resumen_data[k] = calcular_resumen(proj['items'])

    # Escribir archivos
    print(f'\n[3/3] Escribiendo archivos...')
    import shutil
    for _p in [DEST_DET, DEST_RES]:
        if os.path.exists(_p):
            shutil.copy2(_p, _p + '.bak')

    js_det = 'const DETALLE_DATA = ' + json.dumps(detalle_data, ensure_ascii=False) + ';\n'
    with open(DEST_DET, 'w', encoding='utf-8') as f:
        f.write(js_det)
    total_items = sum(len(p['items']) for p in detalle_data.values())
    print(f'  OK {DEST_DET}')
    print(f'     {len(detalle_data)} claves | {total_items} items')

    js_res = 'const ESTADO_RESUMEN = ' + json.dumps(resumen_data, ensure_ascii=False) + ';\n'
    with open(DEST_RES, 'w', encoding='utf-8') as f:
        f.write(js_res)
    print(f'  OK {DEST_RES}')

    # Validacion: si el ppto total es cero en todos los proyectos es señal de
    # que el API no devolvio datos de clase='P' — abortamos para no sobrescribir
    # el archivo anterior con datos corruptos.
    total_ppto = sum(
        v.get('totales', {}).get('cdd', {}).get('ppto', 0) +
        v.get('totales', {}).get('cid', {}).get('ppto', 0)
        for v in detalle_data.values()
    )
    if total_ppto < 1e12:
        print(f'ERROR: ppto total = {total_ppto:,.0f} — sospechosamente bajo.')
        print('  No se sobreescribe el JSON anterior. Revise adp_dtm_fact_controlproyecto clase=P.')
        sys.exit(1)

    dest_json = os.path.normpath(DEST_DET_JSON)
    with open(dest_json, 'w', encoding='utf-8') as f:
        json.dump({'data': detalle_data}, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  OK {dest_json}')

    print('\n' + '='*60)
    print('  COMPLETADO - Recarga el navegador con Ctrl+Shift+R')
    print('='*60)

if __name__ == '__main__':
    main()
