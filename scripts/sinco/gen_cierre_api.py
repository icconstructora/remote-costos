"""
gen_cierre_api.py – Genera cierre_data.json desde cont_cierreproyectos (API Sinco)
Reemplaza gen_cierre.py (Excel) con datos en tiempo real.
"""
import sys, os, json, datetime
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

try:
    import msal, requests
except ImportError:
    os.system(f'{sys.executable} -m pip install msal requests -q')
    import msal, requests

CLIENT_ID = '1da0f9dd-cc35-489c-937b-c66387864730'
TENANT_ID = '129cb8aa-2444-49b4-acc9-3f6a696f1ff0'
SCOPE     = ['api://1da0f9dd-cc35-489c-937b-c66387864730/access_as_user']
API_BASE  = 'https://api.icconstructora.co/api/sinco/data'
BASE      = os.path.dirname(os.path.abspath(__file__))
CACHE_F   = os.path.join(BASE, 'token_cache.json')
_out_dir  = os.environ.get('OUTPUT_DIR') or os.path.join(BASE, '..', '..', 'public', 'data')
DEST      = os.path.normpath(os.path.join(_out_dir, 'cierre_data.json'))

# ── CC descripcion → clave proyecto ───────────────────────────────────────────
CC_KEY_RULES = [
    ('pra-e1',  ['PRAIA NATURA ETAPA 1']),
    ('pra-e2',  ['PRAIA NATURA ETAPA 2']),
    ('pra-zc',  ['PRAIA NATURA COSTOS COMUNES']),
    ('opo-e12', ['RESERVA DE OPORTO ETAPA 1', 'RESERVA DE OPORTO ETAPA 2']),
    ('opo-e3',  ['RESERVA DE OPORTO ETAPA 3']),
    ('hac-e1',  ['LA HACIENDA ETAPA 1', 'HACIENDA ETAPA 1', 'LA HACIENDA JAMUNDI ETAPA 1']),
    ('hac-e3',  ['LA HACIENDA ETAPA 3', 'LA HACIENDA JAMUNDI ETAPA 3']),
    ('hac-ref', ['LA HACIENDA JAMUNDI IC']),
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
    ('praia',   ['PRAIA NATURA']),
    ('oporto',  ['RESERVA DE OPORTO']),
    ('primera', ['PRIMERA ESTE']),
    ('hacienda',['LA HACIENDA']),
    ('hac-real',['HACIENDA REAL']),
    ('bosque',  ['BOSQUE CENTRAL']),
    ('cast-l',  ['CASTILLA LIVING']),
    ('gaia',    ['GAIA']),
    ('azul-t',  ['AZUL TURQUESA']),
    ('azul-c',  ['AZUL CELESTE']),
    ('verde',   ['VERDE VIVO']),
    ('mitika',  ['MITIKA']),
    ('well',    ['WELL']),
    ('cast-i',  ['CASTILLA IMPERIAL']),
]

def cc_to_key(desc):
    if not desc:
        return None
    d = desc.upper()
    for key, terms in CC_KEY_RULES:
        if any(t.upper() in d for t in terms):
            return key
    return None

def parse_val(v):
    try:
        return round(float(str(v or 0).replace(',', '')), 2)
    except:
        return 0.0

def parse_fecha(v):
    if not v:
        return ''
    s = str(v).strip()[:10]
    # ISO → dd/mm/yyyy
    import re
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        return f'{m.group(3)}/{m.group(2)}/{m.group(1)}'
    return s

# ── Auth ──────────────────────────────────────────────────────────────────────
def get_token():
    user = os.environ.get('SINCO_USER')
    pwd  = os.environ.get('SINCO_PASS')
    if user and pwd:
        app = msal.PublicClientApplication(CLIENT_ID, authority=f'https://login.microsoftonline.com/{TENANT_ID}')
        result = app.acquire_token_by_username_password(username=user, password=pwd, scopes=SCOPE)
        if 'access_token' not in result:
            raise RuntimeError(f'Login fallido: {result.get("error_description", result)}')
        return result['access_token']
    cache = msal.SerializableTokenCache()
    if os.path.exists(CACHE_F):
        cache.deserialize(open(CACHE_F, encoding='utf-8').read())
    app = msal.PublicClientApplication(CLIENT_ID,
        authority=f'https://login.microsoftonline.com/{TENANT_ID}', token_cache=cache)
    accounts = app.get_accounts()
    result = app.acquire_token_silent(SCOPE, account=accounts[0]) if accounts else None
    if not result:
        flow = app.initiate_device_flow(scopes=SCOPE)
        print(f'\n  Abre: {flow["verification_uri"]}')
        print(f'  Código: {flow["user_code"]}\n')
        result = app.acquire_token_by_device_flow(flow)
    if cache.has_state_changed:
        open(CACHE_F, 'w', encoding='utf-8').write(cache.serialize())
    return result['access_token']

def main():
    print('='*60)
    print('  gen_cierre_api.py — cont_cierreproyectos')
    print('='*60)

    token = get_token()
    print('Token OK\n')

    print('GET cont_cierreproyectos...', flush=True)
    r = requests.get(f'{API_BASE}/cont_cierreproyectos',
        headers={'Authorization': f'Bearer {token}'},
        timeout=120, stream=True)
    rows = json.loads(b''.join(c for c in r.iter_content(512*1024) if c))
    print(f'  {len(rows):,} filas')

    # Mapeo cuenta → campo de saldo
    ACCT_FIELD = {
        '2825150101': 'gta',
        # '2825150102': excluida — solo se toma 2825150101
        '1490100501': 'cont',
        '1490150501': 'cont',
        '1405100101': 'prov',
    }

    # Agrupar por proyecto → tercero → cuenta
    by_proy = defaultdict(lambda: defaultdict(lambda: {
        'nit': '', 'terc': '', 'cc': '', 'cc_d': '',
        'gta': 0, 'prov': 0, 'cont': 0, 'ret': 0,
        'est': '', 'cron': '', 'obs': [],
    }))
    sin_cc = 0

    for r in rows:
        cc_desc = r.get('centro_de_costos_descripcion') or ''
        key = cc_to_key(cc_desc)
        if not key:
            proy = str(r.get('proyecto') or '').upper()
            key = cc_to_key(proy) or cc_to_key(proy.replace('PROYECTOS MADRID', ''))
            # PROYECTOS MADRID → verde, azul-c, azul-t según campo proyecto
            if not key and 'MADRID' in proy:
                for sub_key, terms in [('verde', ['VERDE VIVO']), ('azul-c', ['AZUL CELESTE']), ('azul-t', ['AZUL TURQUESA'])]:
                    if any(t in proy for t in terms):
                        key = sub_key
                        break
        if not key:
            sin_cc += 1
            continue

        cta   = str(r.get('cuenta_contable') or '').strip()
        nit   = str(r.get('no_identificacion') or '').strip()
        terc  = str(r.get('tercero') or '').strip()
        tk    = nit or terc
        t     = by_proy[key][tk]
        t['nit']  = nit
        t['terc'] = terc
        t['cc']   = str(r.get('centro_de_costos') or '').strip()
        t['cc_d'] = cc_desc.strip()

        sf = parse_val(r.get('saldo_final'))
        field = ACCT_FIELD.get(cta)
        if field:
            t[field] += sf
        # Devolución garantía
        ret = parse_val(r.get('devolucion_retencion_de_garantia'))
        if ret:
            t['ret'] += ret

        # Estado, cronograma y observaciones: tomar del primer registro que los tenga
        if not t['est'] and r.get('estado'):
            t['est'] = str(r['estado']).strip()
        if not t['cron'] and r.get('cronograma_cierre'):
            t['cron'] = str(r['cronograma_cierre']).strip()
        if not t['obs']:
            obs = []
            for i in range(1, 6):
                txt = str(r.get(f'observaciones_{i}') or '').strip()
                fch = parse_fecha(r.get(f'fecha_actualizacion_{i}'))
                if txt:
                    obs.append({'t': txt, 'f': fch})
            if obs:
                t['obs'] = obs

    if sin_cc:
        print(f'  AVISO: {sin_cc} filas sin CC reconocido (omitidas)')

    result = {}
    for key, terc_map in sorted(by_proy.items()):
        # saldo = gta + prov + cont (suma de saldos por tipo de cuenta)
        rows_out = []
        for v in terc_map.values():
            v['saldo'] = round(v['gta'] + v['prov'] + v['cont'], 2)
            if abs(v['saldo']) >= 1 or v['gta'] >= 1:
                rows_out.append(v)

        totales = {
            'gta_cum':     round(sum(r['gta']   for r in rows_out), 2),
            'ant_prov':    round(sum(r['prov']  for r in rows_out), 2),
            'ant_cont':    round(sum(r['cont']  for r in rows_out), 2),
            'saldo_final': round(sum(r['saldo'] for r in rows_out), 2),
            'dev_ret':     round(sum(r['ret']   for r in rows_out), 2),
        }
        result[key] = {'rows': rows_out, 'totales': totales}
        print(f'  {key:12s}: {len(rows_out):3d} terceros  saldo={totales["saldo_final"]:>16,.0f}')

    if not result:
        print('ERROR — sin datos')
        return

    cot = datetime.timezone(datetime.timedelta(hours=-5))
    ts  = datetime.datetime.now(cot).strftime('%d %b %Y %H:%M')
    output = {'generated_at': ts, 'data': result}

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    json.dump(output, open(DEST, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'\nOK — cierre_data.json | {len(result)} proyectos | {ts}')
    print(f'    → {DEST}')

if __name__ == '__main__':
    main()
