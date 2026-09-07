"""
gen_proyecciones_api.py — Genera proyecciones_data.json desde adp_dtm_fact_proyeccion
======================================================================================
Agrupa por proyecto / mes / causa / folio (skidreforma) para alimentar
el tablero de Variación Acumulada y Mensual.
"""
import sys, os, json, datetime, re
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

try:
    import msal, requests
except ImportError:
    os.system(f'{sys.executable} -m pip install msal requests -q')
    import msal, requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sinco_auth import get_token

API_BASE = 'https://api.icconstructora.co/api/sinco/data'
_out_dir  = os.environ.get('OUTPUT_DIR') or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'data')
DEST = os.path.join(_out_dir, 'proyecciones_data.json')

# ── Mapeo skidproyecto → macroKey (mismo que gen_estado_api) ──────────────────
# Proyectos activos — ampliar si se agregan nuevos
SKID_TO_KEY = {
    100186: 'pra-e1',   100187: 'pra-e2',   100306: 'pra-zc',
    100188: 'opo-e12',  100302: 'opo-e3',
    100189: 'pri-e12',  100305: 'pri-zc',
    100190: 'well',     100192: 'well',
    100303: 'hac-ref',  100307: 'hac-e3',
    100147: 'bosque',   100143: 'bosque',
    100193: 'gaia',
    100194: 'mit-11',   100308: 'mit-12',
    100195: 'azt-e1',   100196: 'azt-e2',
    100197: 'azc-e1',   100198: 'azc-e2',   100309: 'azc-e3',
    100199: 'ver-e1',   100200: 'ver-e2',   100310: 'ver-e3',
    100201: 'cai-e2b',  100311: 'cai-zc',
}

MACRO_SUBS = {
    'praia':    ['pra-e1', 'pra-e2', 'pra-zc'],
    'oporto':   ['opo-e12', 'opo-e3'],
    'primera':  ['pri-e12', 'pri-zc'],
    'hacienda': ['hac-e1', 'hac-ref', 'hac-e3'],
    'mitika':   ['mit-11', 'mit-12'],
    'azul-t':   ['azt-e1', 'azt-e2'],
    'azul-c':   ['azc-e1', 'azc-e2', 'azc-e3'],
    'verde':    ['ver-e1', 'ver-e2', 'ver-e3'],
    'cast-i':   ['cai-e2b', 'cai-zc'],
}

MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

def ymLabel_py(ym):
    """'2026-07' → 'Jul 2026'"""
    try:
        y, m = ym.split('-')
        return f'{MESES_ES[int(m)-1]} {y}'
    except Exception:
        return ym

def skid_fecha_to_ym(v):
    """20240229 → '2024-02'. Retorna None para fechas inválidas (< 2020)."""
    s = str(v)
    if len(s) == 8 and s[:4].isdigit() and int(s[:4]) >= 2020:
        return f'{s[:4]}-{s[4:6]}'
    return None

def api_get_paginado(token, tabla, page_size=500):
    import time
    headers = {'Authorization': f'Bearer {token}'}
    url = f'{API_BASE}/{tabla}'
    all_rows, skip = [], 0
    first_page_len = None
    while True:
        print(f'  Página skip={skip}...', flush=True)
        for intento in range(3):
            try:
                r = requests.get(url, headers=headers,
                                 params={'$top': page_size, '$skip': skip},
                                 timeout=600)
                if not r.ok:
                    print(f'  WARN HTTP {r.status_code} en skip={skip}')
                    return all_rows
                rows = r.json()
                rows = rows if isinstance(rows, list) else rows.get('value', rows.get('data', []))
                break
            except Exception as e:
                print(f'  ERROR skip={skip} intento {intento+1}: {e}', flush=True)
                if intento < 2:
                    time.sleep(5)
                else:
                    print('  Abortando paginación.')
                    return all_rows
        if not rows:
            break
        # Si la API ignora $skip y devuelve siempre los mismos datos, parar después de la primera página
        if first_page_len is None:
            first_page_len = len(rows)
        elif skip > 0 and len(rows) == first_page_len:
            print(f'  API ignora paginación (página {skip} = {len(rows)} filas = primera). Usando solo primera página.')
            break
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        skip += page_size
    return all_rows

def build_cap_dim(token):
    """Descarga dim_capitulopresupuesto → {skidcapitulo: {code, desc}}"""
    import requests, time
    headers = {'Authorization': f'Bearer {token}'}
    url = f'{API_BASE}/adp_dtm_dim_capitulopresupuesto'
    for intento in range(3):
        try:
            r = requests.get(url, headers=headers, timeout=120)
            if r.ok:
                rows = r.json()
                if not isinstance(rows, list):
                    rows = rows.get('value', rows.get('data', []))
                break
        except Exception as e:
            print(f'  WARN dim_cap intento {intento+1}: {e}', flush=True)
            if intento < 2:
                time.sleep(5)
            else:
                return {}
    else:
        return {}

    cap_map = {}
    for r in rows:
        skid = r.get('skidcapitulo')
        if not skid:
            continue
        code = (r.get('Capitulo Numero') or r.get('capitulo_numero') or '').strip().upper()
        # Descripción: varios nombres posibles según la API
        desc = (r.get('Nombre') or r.get('nombre') or r.get('Descripcion') or
                r.get('descripcion') or r.get('NombreCapitulo') or r.get('nombre_capitulo') or '').strip()
        if code:
            cap_map[skid] = {'code': code, 'desc': desc}
    print(f'  dim_capitulopresupuesto: {len(cap_map)} capítulos', flush=True)
    return cap_map


def main():
    print('[gen_proyecciones] Iniciando...', flush=True)
    token = get_token()

    print('[1/3] Cargando dimensión de capítulos...', flush=True)
    cap_dim = build_cap_dim(token)

    print('[2/3] Descargando adp_dtm_fact_proyeccion...', flush=True)
    rows = api_get_paginado(token, 'adp_dtm_fact_proyeccion')
    print(f'  Total filas: {len(rows):,}', flush=True)

    if not rows:
        print('ERROR: sin filas')
        sys.exit(1)

    # ── Estructura de salida por sub-proyecto ─────────────────────────────────
    proj_data = defaultdict(lambda: {'meses': defaultdict(lambda: {
        'causas': defaultdict(float),
        'folios': {}
    })})

    causas_set = set()
    seen_ids = set()

    _debug_done = False
    for row in rows:
        row_id = row.get('_row_id')
        if row_id is not None:
            if row_id in seen_ids:
                continue
            seen_ids.add(row_id)

        skid = row.get('skidproyecto')
        sub_key = SKID_TO_KEY.get(skid)
        if not sub_key:
            continue

        if not _debug_done and sub_key == 'well':
            print(f'  [DEBUG] Campos fila WELL: {sorted(row.keys())}', flush=True)
            print(f'  [DEBUG] skidreforma={row.get("skidreforma")!r}', flush=True)
            _debug_done = True

        ym = skid_fecha_to_ym(row.get('skidfechaaprobacion'))
        if not ym:
            ym = skid_fecha_to_ym(row.get('skidfechanovedad'))
        if not ym:
            continue

        causa_desc = row.get('Descripcion Causa') or 'Otra'
        valor = float(row.get('Valor_Total') or row.get('Valor Total') or 0)
        comentario = (row.get('comentario') or row.get('Comentario') or '').strip()

        # Resolver capítulo desde la dimensión
        skid_cap = row.get('skidcapitulo')
        cap_info = cap_dim.get(skid_cap, {})
        cap_code = cap_info.get('code', '')   # e.g. "CDD06"
        cap_desc = cap_info.get('desc', '')   # e.g. "CIMENTACION"

        # Extraer folio: primero campo explícito, luego regex en comentario
        folio_text = (row.get('Folio') or row.get('folio') or row.get('Reforma') or
                      row.get('NombreReforma') or row.get('reforma') or '').strip()
        folio_num = row.get('skidreforma')
        if folio_text:
            folio = folio_text
        elif folio_num:
            folio = f'Folio {folio_num}'
        else:
            m = re.search(r'(?:folio|reforma)\s*(\d+)', comentario, re.IGNORECASE)
            folio = f'Folio {m.group(1)}' if m else None

        causas_set.add(causa_desc)
        proj_data[sub_key]['meses'][ym]['causas'][causa_desc] += valor

        folio_label = folio if folio else None
        folio_key = f"{folio_label}|{ym}" if folio_label else f"anon|{ym}|{comentario[:40]}"
        fd = proj_data[sub_key]['meses'][ym]['folios']
        if folio_key not in fd:
            fd[folio_key] = {
                'folio':      folio_label or f'({ymLabel_py(ym)})',
                'causa':      causa_desc,
                'capitulo':   cap_code,
                'caps':       [cap_desc] if cap_desc else [],
                'capKeys':    [cap_code] if cap_code else [],
                'valor':      0,
                'comentario': comentario,
            }
        else:
            # Acumular caps/capKeys si el folio tiene más de un capítulo
            entry = fd[folio_key]
            if cap_desc and cap_desc not in entry['caps']:
                entry['caps'].append(cap_desc)
            if cap_code and cap_code not in entry['capKeys']:
                entry['capKeys'].append(cap_code)
        fd[folio_key]['valor'] += valor

    # ── Serializar ─────────────────────────────────────────────────────────────
    out = {}
    for sub_key, sd in proj_data.items():
        meses_out = {}
        for ym, md in sorted(sd['meses'].items()):
            meses_out[ym] = {
                'causas': dict(md['causas']),
                'folios': list(md['folios'].values()),
            }
        out[sub_key] = {'meses': meses_out}

    # ── Agregar macros (suma de sub-etapas) ───────────────────────────────────
    for macro_key, subs in MACRO_SUBS.items():
        meses_combined = defaultdict(lambda: {
            'causas': defaultdict(float),
            'folios': {}
        })
        for sub in subs:
            if sub not in out:
                continue
            for ym, md in out[sub]['meses'].items():
                for causa, val in md['causas'].items():
                    meses_combined[ym]['causas'][causa] += val
                for f in md['folios']:
                    fk = str(f['folio'])
                    if fk not in meses_combined[ym]['folios']:
                        meses_combined[ym]['folios'][fk] = dict(f)
                        meses_combined[ym]['folios'][fk]['caps'] = list(f.get('caps', []))
                        meses_combined[ym]['folios'][fk]['capKeys'] = list(f.get('capKeys', []))
                    else:
                        entry = meses_combined[ym]['folios'][fk]
                        entry['valor'] += f['valor']
                        for c in f.get('caps', []):
                            if c not in entry['caps']:
                                entry['caps'].append(c)
                        for c in f.get('capKeys', []):
                            if c not in entry['capKeys']:
                                entry['capKeys'].append(c)
        if meses_combined:
            out[macro_key] = {'meses': {
                ym: {
                    'causas': dict(md['causas']),
                    'folios': list(md['folios'].values()),
                }
                for ym, md in sorted(meses_combined.items())
            }}

    print('[3/3] Construyendo JSON...', flush=True)
    resultado = {
        'generatedAt': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-5))).strftime('%d %b %Y %H:%M'),
        'causas': sorted(causas_set),
        'proyectos': out,
    }

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    with open(DEST, 'w', encoding='utf-8') as f:
        json.dump(resultado, f, ensure_ascii=False)
    print(f'[gen_proyecciones] OK → {DEST}', flush=True)
    print(f'  Causas encontradas: {sorted(causas_set)}', flush=True)

if __name__ == '__main__':
    main()
