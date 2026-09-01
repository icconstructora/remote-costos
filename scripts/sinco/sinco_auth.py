"""
sinco_auth.py — Autenticación SINCO unificada
===============================================
- En GitHub Actions: usa SINCO_USER + SINCO_PASS (variables de entorno)
  via acquire_token_by_username_password (ROPC flow).
- En PC local: comportamiento original — token cacheado en token_cache.json,
  con fallback a device flow si el cache venció.

Uso en cada script:
    from sinco_auth import get_token
    token = get_token()
"""
import os, sys

try:
    import msal
except ImportError:
    os.system(f'{sys.executable} -m pip install msal -q')
    import msal

CLIENT_ID = '1da0f9dd-cc35-489c-937b-c66387864730'
TENANT_ID = '129cb8aa-2444-49b4-acc9-3f6a696f1ff0'
SCOPE     = ['api://1da0f9dd-cc35-489c-937b-c66387864730/access_as_user']
CACHE_F   = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'token_cache.json')


def get_token() -> str:
    user = os.environ.get('SINCO_USER')
    pwd  = os.environ.get('SINCO_PASS')

    # ── Nube (GitHub Actions): ROPC con usuario/contraseña ──────────────────
    if user and pwd:
        print('  [auth] GitHub Actions — ROPC login...', flush=True)
        app = msal.PublicClientApplication(
            CLIENT_ID,
            authority=f'https://login.microsoftonline.com/{TENANT_ID}',
        )
        result = app.acquire_token_by_username_password(
            username=user,
            password=pwd,
            scopes=SCOPE,
        )
        if 'access_token' not in result:
            err = result.get('error_description') or result.get('error') or str(result)
            raise RuntimeError(f'[sinco_auth] Login ROPC fallido: {err}')
        print('  [auth] Token OK (ROPC)', flush=True)
        return result['access_token']

    # ── Local: token cacheado + device flow de respaldo ─────────────────────
    print('  [auth] Local — token cacheado...', flush=True)
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
        raise RuntimeError(f'[sinco_auth] No se pudo obtener token: {result.get("error_description", result)}')

    if cache.has_state_changed:
        open(CACHE_F, 'w', encoding='utf-8').write(cache.serialize())

    print('  [auth] Token OK (cache)', flush=True)
    return result['access_token']
