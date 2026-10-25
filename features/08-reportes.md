# Feature 08 · Reportes

## Historia de usuario

**Como** dueña de Pet Garden
**quiero** ver un resumen por fechas y descargar un Excel con toda la información
**para** saber cuánto vendo, qué servicios pido más y cuánto deja cada mascota y cada dueño.

## Reglas de negocio

1. Período: botones **Este mes** (por defecto), **Mes pasado**, **Últimos 3 meses**, **Este año**, **Todo**, o fechas **Desde / Hasta**. El resumen se recalcula al cambiarlas y las fechas se recuerdan al volver a la pantalla.
2. "Desde" no puede ser posterior a "Hasta".
3. Los ingresos salen del **historial** (servicios realizados): suma de `precio_cobrado`.
4. **Indicadores**: ingresos, servicios realizados, valor promedio, mascotas atendidas, clientes atendidos, baños medicados, mascotas registradas (total) y clientes registrados (total y activos). Debajo, las citas del período por estado.
5. Tablas en pantalla: **Por servicio** y **Por mes** (cantidad, total y fila de totales); **Dueños** (suma de todas sus mascotas) y **Mascotas** (todas las registradas), ordenables y filtrables.
6. **Descargar Excel**: archivo `PetGarden-reporte-<desde>_a_<hasta>.xlsx` con 7 hojas:

   | Hoja | Contenido |
   |------|-----------|
   | Resumen | Período, fecha de generación e indicadores |
   | Historial | Cada servicio: fecha, mascota, especie, raza, dueño, teléfono, servicio, medicado, recargo, guía, precio, notas |
   | Mascotas | Todas las mascotas con datos, visitas, última visita, servicios y total del período |
   | Dueños | Todos los dueños con cantidad y nombres de mascotas, servicios y total del período |
   | Citas | Citas del período con estado, precio acordado y cobrado |
   | Por servicio | Cantidad y total por tipo de servicio |
   | Por mes | Cantidad y total por mes |

7. Cada hoja tiene **filtros en los encabezados**, formato de dinero (`$#,##0`) y de fecha (`dd/mm/aaaa`), y una **fila de totales** con fórmula `SUMA` y la cantidad de registros.
8. La librería de Excel se descarga solo al presionar el botón. Sin internet se muestra un mensaje de error.

## Escenarios

```gherkin
# language: es
Característica: Reportes

  Antecedentes:
    Dado que inicié sesión
    Y estoy en "Reportes"

  Escenario: Período por defecto
    Entonces "Este mes" está seleccionado
    Y "Desde" es el día 1 del mes y "Hasta" es hoy

  Escenario: Indicadores del período
    Dado que este mes hubo 10 servicios que suman $400.000
    Entonces "Ingresos por servicios" muestra $400.000
    Y "Valor promedio por servicio" muestra $40.000

  Escenario: Todo el historial
    Cuando presiono "Todo"
    Entonces "Desde" y "Hasta" quedan vacíos
    Y el período dice "Todo el historial"

  Escenario: Fechas personalizadas
    Cuando escribo Desde "01/09/2026" y Hasta "30/09/2026"
    Entonces ningún botón de período queda seleccionado
    Y el resumen muestra solo septiembre

  Escenario: Rango inválido
    Cuando pongo "Desde" posterior a "Hasta"
    Entonces veo el error: La fecha "desde" no puede ser posterior a la fecha "hasta".

  Escenario: Suma por dueño con todas sus mascotas
    Dado que Ana tiene a "Luna" ($488.000) y a "Simba" ($90.000) en el período
    Entonces en "Dueños" Ana muestra 2 mascotas y $578.000

  Escenario: Todas las mascotas aunque no hayan venido
    Dado que "Rocky" no tuvo servicios en el período
    Entonces "Rocky" aparece en "Mascotas" con 0 servicios y $0

  Escenario: Descargar Excel
    Cuando presiono "⬇ Descargar Excel"
    Entonces se descarga "PetGarden-reporte-<desde>_a_<hasta>.xlsx"
    Y tiene las hojas Resumen, Historial, Mascotas, Dueños, Citas, Por servicio y Por mes
    Y la última fila de "Historial" suma el precio cobrado de todos los servicios

  Escenario: Totales consistentes
    Entonces el total de "Historial", "Mascotas", "Dueños", "Por servicio" y "Por mes" es el mismo
    Y coincide con "Ingresos por servicios"

  Escenario: Los servicios eliminados no cuentan
    Dado que eliminé un servicio de $40.000
    Cuando recalculo el reporte
    Entonces los ingresos bajan $40.000
```

## Novedades v4

1. Si en el período se cancelaron servicios realizados, aparece un aviso amarillo con cuántos fueron y cuánto dinero dejó de contar.
2. Nueva tabla **"Servicios cancelados"**: cancelado el, por, mascota, servicio, fecha del servicio, valor tachado y motivo. El período se mide por la **fecha en que se canceló**.
3. Excel: nueva hoja **"Cancelados"**. La hoja "Citas" agrega **Cancelada por**, **Cancelada el** y **Motivo de cancelación**. "Resumen" agrega la cantidad y el dinero de servicios cancelados.
4. Los cancelados **no suman** en ingresos ni en ninguna otra hoja.

```gherkin
# language: es
Característica: Control de cancelaciones en Reportes

  Escenario: Ver quién canceló
    Dado que Jessica canceló un servicio de $35.000 este mes
    Cuando abro Reportes con "Este mes"
    Entonces veo "⚠ 1 servicio realizado fue cancelado en este período ($35.000 que ya no cuentan)"
    Y en "Servicios cancelados" veo a Jessica, la fecha, el servicio y el motivo

  Escenario: Excel con cancelados
    Cuando descargo el Excel
    Entonces tiene la hoja "Cancelados" con su total
    Y en "Citas" cada cita cancelada dice quién, cuándo y por qué

  Escenario: Los ingresos no incluyen cancelados
    Entonces "Ingresos por servicios" no incluye los $35.000 cancelados
```

## Novedades v13: respaldo completo

### Reglas
1. Tarjeta **Respaldo de la base de datos** con el botón **⬇ Descargar respaldo completo** (solo administrador, porque está en Reportes).
2. Descarga `Respaldo_PetGarden_AAAA-MM-DD.xlsx` con una hoja **Contenido** (tabla y número de filas) y **una hoja por tabla**: clientes, mascotas, citas, servicios, servicios_anulados, razas, tipos_servicio, grupos_recordatorio, guias, videos, pendientes_descartados, perfiles. Trae todas las filas, sin límite.
3. Muestra la fecha del último respaldo hecho desde ese navegador y avisa si pasó más de un mes.

```gherkin
# language: es
Característica: Respaldo

  Escenario: Descargar respaldo
    Dado que inicié sesión como administrador y estoy en "Reportes"
    Cuando presiono "Descargar respaldo completo"
    Entonces se descarga "Respaldo_PetGarden_<fecha>.xlsx"
    Y la primera hoja es "Contenido"
    Y hay una hoja por cada tabla
    Y veo "Respaldo descargado. Guárdalo en un lugar seguro (por ejemplo, Google Drive)."
```
