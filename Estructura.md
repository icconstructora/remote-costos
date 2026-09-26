# VIC WEB — Estructura de la aplicación

> Documentación técnica y funcional de todas las vistas, gráficas y fuentes de datos.
> Generada: Sep 2026

---

## Arquitectura general

La app es un SPA React desplegada en **Azure Static Web Apps**. Los datos son archivos JSON
pre-generados por scripts Python desde la API Sinco. No hay backend en tiempo real;
todo lo que se muestra viene de `/public/data/*.json`.

```
API Sinco (IC) ──► scripts/sinco/gen_*.py ──► public/data/*.json ──► React (src/)
Excel SharePoint ──► gen_liquidados.py / gen_cierre.py ──► JSON / JS
```

**Repositorio:** `github.com/icconstructora/remote-costos` (rama `main`)
**Producción:** `vic.icconstructora.co`
**Deploy:** push a `main` → Azure CI/CD (~2 min build)

---

## Archivos de datos

| Archivo JSON | Script generador | Fuente API | Frecuencia |
|---|---|---|---|
| `contracts_data.json` | `gen_contracts_api.py` | `adp_dtm_*` (contratos ADPRO) | Manual / noche |
| `estado_detalle_data.json` | `gen_estado_api.py` | `skid_*` + Excel presupuesto | Manual |
| `balance_data.json` | `gen_balance_api.py` | `fin_dtm_saldos`, `fin_dtm_movimientos`, `sgd_dtm_estadofacturas` | Manual |
| `consumido_data.json` | `gen_consumido_api.py` | `fin_dtm_movimientos` | Manual / noche |
| `compras_data.json` | `gen_compras_api.py` | `adp_dtm_*` (órdenes ADP) | Manual / noche |
| `anticipos_data.json` | `gen_anticipos_api.py` | `adp_dtm_anticipos`, `fin_dtm_saldos` | Manual / noche |
| `proyecciones_data.json` | `gen_proyecciones_api.py` | `skid_dtm_folios` (folios aprobados) | Manual |
| `liquidados_data.json` | `gen_liquidados.py` | Excel "Liquidado a DD.MM.AA.xlsx" → hoja "A procesar" | Manual |
| `update_manifest.json` | todos los scripts | — | Cada ejecución |

---

## Proyectos disponibles (`macroKey`)

| macroKey | Label | Sub-proyectos |
|---|---|---|
| `bosque` | Bosque Central | — |
| `cast-i` | Castilla Imperial | `cai-e2b`, `cai-zc` |
| `cast-l` | Castilla Living | — |
| `gaia` | Condominio Gaia | — |
| `oporto` | Reserva de Oporto | `opo-e12`, `opo-e3` |
| `mitika` | Mitika | `mit-11`, `mit-t5`, `mit-t6`, `mit-t7` |
| `well` | Well | — |
| `primera` | Primera Este | `pri-e12`, `pri-zc` |
| `praia` | Praia Natura | `pra-e1`, `pra-e2`, `pra-zc` |
| `hacienda` | La Hacienda | `hac-e1`, `hac-e3`, `hac-ref`, `hac-real` |
| `verde` | Verde Vivo | `ver-e1`, `ver-e2`, `ver-e3` |
| `azul-c` | Azul Celeste | `azc-e1`, `azc-e2`, `azc-e3` |
| `azul-t` | Azul Turquesa | `azt-e1`, `azt-e2` |

---

## Dashboard — Vista principal

**URL:** `/`
**Archivo:** `src/pages/Dashboard.jsx`

Selector de proyectos (chips con imagen) + 4 paneles en cuadrícula 2×2.
Sub-filtros por etapa/zona en la barra superior de cada proyecto.

**Barra de estado de actualización (CorteBar):**
- Fuente: `update_manifest.json`
- Muestra: `last_run` (última ejecución), `all_ok` (semáforo verde/rojo), estado de cada script

---

## Panel 1 — Estado de Costos

**Componente:** `src/components/Panel1Estado.jsx`
**Página de detalle:** `src/pages/EstadoDetalle.jsx` → URL `/estado/:macroKey`

### ¿Qué muestra?

**Gráfico de 5 barras verticales (SVG):**

| Barra | Qué representa | Cálculo |
|---|---|---|
| **Presupuesto** | Costo base aprobado | `pptoCaps` (por capítulo CDD/CID) |
| **Proyectado** | Ppto + variaciones aprobadas | `pptoTotal + causaAcumTotal` (desde proyecciones) |
| **Asegurado** | Valor contratado comprometido | `totales.cdd.aseg + totales.cid.aseg` |
| **Consumido** | Costo ejecutado a la fecha | `totales.cdd.cons + totales.cid.cons` |
| **Por Asegurar** | Proyectado − Asegurado | `proy − aseg` por capítulo |

Cada barra se divide en **CDD** (costo directo, verde) y **CID** (costo indirecto, dorado).

**Panel derecho — Top 5 partidas críticas:**
- Capítulos con mayor valor "Por Asegurar" (`pa`)
- Crítico: `pa/proy > 70%`

### Fuente de datos
- **`estado_detalle_data.json`** → `data[subKey]`
  - `items[].{ num, cap, tipo, ppto, proy, aseg, cons, pa, pct }`
  - `items[].subs[].{ num, desc, proy, aseg, pa }`
  - `totales.{ cdd: {ppto,proy,aseg,cons}, cid: {ppto,proy,aseg,cons} }`
  - `fechaCorte`, `mesesProgramados`

### Navegación desde el panel
- "Ver detalle proyecciones" → `/proyecciones/{macroKey}`
- "Ver por asegurar" → `/estado/{macroKey}` (tabla completa de capítulos con sub-ítems)

---

## Panel 2 — Consumido mensual

**Componente:** `src/components/Panel2Consumido.jsx`

### ¿Qué muestra?

**Barras apiladas — últimos 10 meses:**
- Barra azul: CDD (Costo Directo de Dirección)
- Barra dorada: CID (Costo Indirecto de Dirección)
- Semáforo: `%CID = CID/CDD*100` → verde <6%, amarillo ≤9%, rojo >9%

**Modal "Detalle CID" — últimos 4 meses:**
- Tabla de conceptos de gasto administrativo

### Fuente de datos
- **`consumido_data.json`** → `data[subKey][-10:]`
  - `label` (ej. "Ago 26"), `cdd`, `cid`
- Modal: `detalle[subKey][-4:]`
  - `label`, `cid51` (Nómina), `cid52` (Servicios Públicos), `cid53` (Gastos Obra), `cid54` (SST), `cid_int` (Interventoría)

---

## Panel 3 — Estado de Contratos

**Componente:** `src/components/Panel3Contratos.jsx`
**Página de detalle:** `src/pages/ContratosDetalle.jsx` → URL `/contratos/:macroKey`

### ¿Qué muestra?

**Embudo / funnel de estados ADPRO:**

| Estado | Condición derivada |
|---|---|
| `por_aprobacion` | En elaboración, sin ejecutar |
| `no_inic_venc` | Fecha inicio pasada, sin consumo |
| `en_ejecucion` | Con acumulado > 0, fecha vigente |
| `venc_con_saldo` | Fecha final pasada, con faltante |
| `liquidar` | Terminado, aún con saldo RteGarantía o anticipo |
| `por_cerrar` | Saldo ~0, esperando cierre formal |
| `cerrado` | Liquidados (cruzado con `liquidados_data.json`) |

**Panel derecho — Card A&F:**
- `gar_cum` (Garantía Cumplimiento A&F)
- `con_acta + con_acta_ek` (Con Acta SGD)
- `ant_cont` (Anticipo Contratistas A&F)
- `%Con Acta = (con_acta + con_acta_ek) / gar_cum`
- **Irregularidades:** terceros donde `GtaCumpl − ConActa > SaldoRte + 1.000`

### Fuente de datos
- **`contracts_data.json`** → `data[]` (filtrado por `r.proyecto`)
  - `noContrato`, `contratista`, `valorContrato`, `acumulado`, `saldoAnticipo`, `saldoRte`
  - `faltante`, `fechaFinal`, `estadoSinco`, `ultimaActa`, `tuvoAnticipo`, `tuvoRteGarantia`
- **`balance_data.json`** → `data[subKey].totals`
  - `gar_cum`, `completado`, `liquidado`, `con_acta`, `con_acta_ek`, `ant_cont`
- **`liquidados_data.json`** → `data[noContrato].liquidado` (para marcar como `cerrado`)

### Navegación
- Click estado → `/contratos/{macroKey}` con `filtroEstado`
- Click A&F → `/balance/{macroKey}`
- "Ver estado liquidación" → URL externa de cierre

---

## Panel 4 — Estado de Compras

**Componente:** `src/components/Panel4Anticipos.jsx`
**Página de detalle:** `src/pages/ComprasDetalle.jsx` → URL `/compras/:macroKey`

### ¿Qué muestra?

**Embudo de estados ADP (órdenes de compra):**
- Aprobada → En Proceso Entrega → Generada → Completada / Cerrada / Cancelada / Anulada

**Panel derecho — Card A&F vs ADPRO:**
- `ant_prov_af` (Anticipo Proveedores en A&F)
- `ant_amort_af` (Amortizado en A&F)
- `saldo_af` (Saldo A&F por amortizar)
- `saldo_adpro` (Saldo ADPRO por amortizar)
- `diferencia = saldo_af − saldo_adpro`
- `sin_mov` (anticipos >2 meses sin movimiento)
- `pct_amort` (% amortizado) — barra de progreso coloreada

**Si no hay anticipos proveedores:** muestra card "A&F · Balance" con `gar_cum` y `ant_cont` del `balance_data.json`.

### Fuente de datos
- **`compras_data.json`** → `data[subKey]`
  - `total_n`, `total_valor`, `estados[key].{n, valor}`
  - `rows[].{ compra_no, proveedor, fecha_compra, fecha_ultima_entrada, dias_sin_entrada, estado, valor_compra, saldo_por_entregar }`
- **`anticipos_data.json`** → `data[subKey]`
  - `ant_prov_af`, `ant_amort_af`, `saldo_af`, `saldo_adpro`, `diferencia`
  - `sin_mov`, `n_sin_mov`, `sin_mov_terceros[]`
  - `pct_amort`, `irr_terceros[]`, `n_irr`
- **`balance_data.json`** → fallback cuando `ant` es null

---

## ProyeccionesDetalle — Proyecciones de costo

**URL:** `/proyecciones/:macroKey`
**Archivo:** `src/pages/ProyeccionesDetalle.jsx`

### ¿Qué muestra?

**Panel P1 — Escalera acumulada por año:**
Gráfico "staircase" de anillos concéntricos. Cada año muestra cómo la proyección total crece desde el presupuesto base.

| Anillo | Valor |
|---|---|
| Base | `pptoTotal` (presupuesto por capítulo) |
| 2024 | `pptoTotal + Σcausas(2024)` |
| 2025 | `pptoTotal + Σcausas(2024+2025)` |
| 2026* | `pptoTotal + Σcausas(todos)` |

KPIs: Ppto Base · Proyección actual · Variación total · Meses de ejecución

**Panel P1-derecha — Variación mensual:**
- Chips de mes del año seleccionado
- Barras por causa (incrementos, omisiones, cambios de especificación, etc.)
- Filtro de semana (chips Vie-Jue) → tabla de folios de esa semana

**Paneles P3/P4 — Tabla de folios:**
- Filtro por causa activa O por actividad (grupo CDD)
- Columnas: Folio · Causa · Capítulo · Valor · Fecha

### Fuente de datos
- **`proyecciones_data.json`** → `proyectos[macroKey]`
  - `mesesProgramados`
  - `pptoCaps[CDD##]` — presupuesto por código de capítulo
  - `meses[YYYY-MM].causas[nombreCausa]` — variación acumulada por causa
  - `meses[YYYY-MM].folios[].{ folio, causa, valor, fecha(YYYYMMDD), capKeys[], capVals{CDD##: val}, comentario }`
- **`estado_detalle_data.json`** → fallback para presupuesto por capítulo

### Reglas importantes
- Solo se incluyen folios con `skidfechaaprobacion` válida (≥ 2020). Folios con fecha `19000101` (sentinel Sinco de "no aprobado") se excluyen completamente desde el script generador.
- Las semanas se calculan en ciclos Vie-Jue.
- Normalización de causas: "Incremento de precio", "Incremento de Precio de…" → todas se unifican como "Incrementos".

---

## BalanceDetalle — Garantías y Anticipos

**URL:** `/balance/:macroKey`
**Archivo:** `src/pages/BalanceDetalle.jsx`

### ¿Qué muestra?

Tabla por tercero con 6 columnas financieras:

| Columna | Campo | Descripción |
|---|---|---|
| Gta. Cumplimiento | `gar_cum` | Saldo garantía cumplimiento en A&F |
| Con Acta | `con_acta` | Retegarantía con acta SGD (F019/F029 Sinco) |
| Con Acta EK | `con_acta_ek` | Retegarantía con acta SGD (F019/F029 EK) |
| Ant. Contratistas | `ant_cont` | Anticipo contratistas en A&F (cta. 1490) |
| Dev. Ret. Garantía | `dev_ret` | Devolución retención garantía (cta. 2220) |
| Completado/Liquidado | — | Suma `completado + liquidado` |

**Cards de resumen:**
- `gar_cum` total · `ant_cont` total · `con_acta + con_acta_ek` total
- `%Con Acta = (con_acta + con_acta_ek) / gar_cum`

### Fuente de datos
- **`balance_data.json`** → `data[subKey]`
  - `rows[].{ acct, tercero, saldo, saldo_ant, nc }`
  - `totals.{ gar_cum, ant_cont, con_acta, con_acta_ek, liquidado, completado }`

### Cuentas contables mapeadas
| Cuenta | Categoría en balance |
|---|---|
| 2825150101 | Gta. Cumplimiento |
| 1490100501 | Ant. Contratistas |
| 2220060001 | Dev. Ret. Garantía |
| SGD F019/F029 Sinco | Con Acta |
| SGD F019/F029 EK | Con Acta EK |

---

## EstadoDetalle — Por Asegurar

**URL:** `/estado/:macroKey`
**Archivo:** `src/pages/EstadoDetalle.jsx`

### ¿Qué muestra?

Grid de 3 columnas con capítulos de costo:
- **Críticos** (`pa/proy > 70%`): requieren aseguramiento urgente
- **Otros saldos** (`pa/proy ≤ 70%`): en proceso normal
- **Gastos Administrativos** (CID): tipo `'cid'`

Cada capítulo es expandible → sub-ítems con valores detallados.

**Exporta CSV:** `por_asegurar_{macroKey}.csv` con todos los capítulos y sub-ítems.

### Fuente de datos
- **`estado_detalle_data.json`** → `data[subKey].items[]`
  - `num`, `cap`, `tipo`, `ppto`, `proy`, `aseg`, `cons`, `pa`, `pct`
  - `subs[].{ num, desc, proy, aseg, pa }`

---

## ComprasDetalle — Órdenes de Compra

**URL:** `/compras/:macroKey`
**Archivo:** `src/pages/ComprasDetalle.jsx`

### ¿Qué muestra?

Tabla de órdenes de compra ADP con:
- Cards de resumen por estado
- Días sin entrada (alerta roja si >40 días en "En Proceso Entrega")
- **Modo "Diferencia módulos":** terceros donde `saldo_af ≠ saldo_adpro`
- **Modo "Anticipos sin mov.":** proveedores sin movimiento >2 meses

### Fuente de datos
- **`compras_data.json`** → `data[subKey].rows[]`
  - `compra_no`, `proveedor`, `estado`, `valor_compra`, `saldo_por_entregar`
  - `fecha_compra`, `fecha_ultima_entrada`, `dias_sin_entrada`
- **`anticipos_data.json`** → `data[subKey]`
  - `irr_terceros[]`: `{ nit, nombre, saldo_adpro, saldo_af }`
  - `sin_mov_terceros[]`: `{ nit, nombre, dias_sin_mov, saldo }`

---

## Reglas de clasificación de contratos

```
classifyContract(r):
  si liquidados[r.noContrato].liquidado > 0  → "cerrado"
  si faltante ≈ 0 y saldoAnticipo ≈ 0 y saldoRte ≈ 0  → "por_cerrar"
  si estadoSinco = "Terminado" y (saldoRte > 0 o saldoAnticipo > 0)  → "liquidar"
  si acumulado > 0 y fechaFinal < hoy y faltante > 0  → "venc_con_saldo"
  si acumulado > 0 y fechaFinal ≥ hoy  → "en_ejecucion"
  si acumulado ≈ 0 y fechaInicial < hoy  → "no_inic_venc"
  si acumulado ≈ 0 y fechaInicial ≥ hoy  → "por_aprobacion"
  else  → "sin_clasificar"
```

---

## Scripts de generación de datos

Todos los scripts están en `scripts/sinco/` y leen del mismo API Sinco.

| Script | Tablas API consumidas |
|---|---|
| `gen_contracts_api.py` | `adp_dtm_contratos`, `adp_dtm_actacontrato`, `adp_dtm_anticipos` |
| `gen_estado_api.py` | `skid_dtm_folios`, `skid_dtm_actividad`, `fin_dtm_*` |
| `gen_balance_api.py` | `fin_dtm_saldos`, `fin_dtm_movimientos`, `fin_dtm_centroscostos`, `fin_dtm_terceros`, `sgd_dtm_estadofacturas`, `sgd_dtm_descriptorescorrespondencia` |
| `gen_consumido_api.py` | `fin_dtm_movimientos`, `fin_dtm_centroscostos` |
| `gen_compras_api.py` | `adp_dtm_ordenesdecompra`, `adp_dtm_entradas` |
| `gen_anticipos_api.py` | `adp_dtm_anticipos`, `fin_dtm_saldos`, `fin_dtm_terceros` |
| `gen_proyecciones_api.py` | `skid_dtm_folios` (solo `skidfechaaprobacion` válida ≥ 2020) |
| `gen_liquidados.py` | Excel `Liquidado a DD.MM.AA.xlsx` → hoja "A procesar" |

---

## Exclusiones y reglas de negocio importantes

1. **Folios `19000101`:** `skidfechaaprobacion = 19000101` es el sentinel de Sinco para "no aprobado". Se excluyen en TODOS los proyectos y en TODOS los módulos desde el script `gen_proyecciones_api.py`.
2. **`skid_fecha_to_ym(v)`:** retorna `None` si el año < 2020 (cubre el sentinel 1900).
3. **Presupuesto fijo:** algunos proyectos tienen `FIXED_PPTO` hardcodeado en `Panel1Estado.jsx` cuando el presupuesto del JSON no coincide con el Excel oficial.
4. **Macro vs Sub-proyecto:** `balance_data.json` y `estado_detalle_data.json` usan `subKey` (ej. `mit-11`); `contracts_data.json` usa prefijo de texto en `r.proyecto`.
5. **Liquidados:** `liquidados_data.json` viene del Excel de liquidación F029. Un contrato se marca `cerrado` en la webapp si `liquidados[noContrato].liquidado > 0`.
