# Feature 02 · Hoy

## Historia de usuario

**Como** dueña de Pet Garden
**quiero** ver en una sola pantalla las citas del día y los clientes que ya deben volver
**para** atender a tiempo y escribirles por WhatsApp a quienes toca recordar.

## Reglas de negocio

1. **Indicadores** (arriba):
   - *Citas de hoy*: citas del día actual (hora Bogotá), sin contar las canceladas.
   - *Clientes por buscar*: número de clientes **distintos** en la vista `pendientes`.
   - *Servicios este mes*: servicios con fecha desde el día 1 del mes actual.
2. **Citas de hoy** se ordenan por hora. Cada una muestra hora, mascota (enlace a la ficha), dueño, servicio, "(medicado)" si aplica y precio.
3. Precio mostrado: si la cita está **realizada** → `precio_cobrado`; si no → `precio_acordado` o, si no hay, el precio sugerido.
4. Citas **pendientes** muestran el botón **Terminar**; las demás muestran su estado como etiqueta.
5. **A quién buscar hoy** se ordena por más días de retraso primero. Etiqueta:
   - `dias_de_retraso <= 0` → "Toca hoy"
   - `1` → "Hace 1 día"
   - `> 1` → "Hace N días" (en estilo atrasado)
6. Los clientes inactivos no aparecen en "A quién buscar" (lo resuelve la vista `pendientes`).
7. **WhatsApp**: abre `wa.me` en otra pestaña. Si el teléfono tiene 10 dígitos se le antepone `57` (Colombia). El mensaje incluye nombre del cliente, nombre del negocio, nombre de la mascota, fecha de la última visita y grupo del servicio.
8. **Agendar** desde un pendiente lleva a "Agendar" con la mascota y el teléfono ya llenos.

## Escenarios

```gherkin
# language: es
Característica: Pantalla Hoy

  Antecedentes:
    Dado que inicié sesión
    Y estoy en la pantalla "Hoy"

  Escenario: Indicadores del día
    Dado que hoy hay 3 citas pendientes, 1 realizada y 1 cancelada
    Y hay 4 mascotas pendientes de 3 clientes distintos
    Entonces "Citas de hoy" muestra 4
    Y "Clientes por buscar" muestra 3

  Escenario: Sin citas para hoy
    Dado que no hay citas para hoy
    Entonces veo "No tienes citas para hoy."

  Escenario: Cita pendiente con botón Terminar
    Dado que hay una cita pendiente de "Toby" a las 10:00 a. m.
    Entonces la veo con la hora, el dueño, el servicio y el precio acordado
    Y veo el botón "Terminar"

  Escenario: Cita realizada muestra el precio cobrado
    Dado que la cita de "Toby" está realizada con precio cobrado $35.000
    Entonces veo $35.000 y la etiqueta "realizada"
    Y no veo el botón "Terminar"

  Escenario: Terminar una cita desde Hoy
    Cuando presiono "Terminar" en una cita pendiente
    Entonces se abre la ventana "Terminar cita"
    Y al marcarla como realizada la lista de Hoy se actualiza

  Escenario: Abrir la ficha de una mascota
    Cuando hago clic en el nombre de una mascota
    Entonces se abre su ficha e historial en una ventana

  Esquema del escenario: Etiqueta de retraso en "A quién buscar"
    Dado una mascota pendiente con <dias> días de retraso
    Entonces veo la etiqueta "<etiqueta>"

    Ejemplos:
      | dias | etiqueta     |
      | 0    | Toca hoy     |
      | -2   | Toca hoy     |
      | 1    | Hace 1 día   |
      | 12   | Hace 12 días |

  Escenario: Orden de "A quién buscar"
    Dado pendientes con 2, 15 y 7 días de retraso
    Entonces se muestran en orden 15, 7, 2

  Escenario: Nadie por buscar
    Dado que la vista de pendientes está vacía
    Entonces veo "Nadie por buscar por ahora."

  Escenario: Enviar recordatorio por WhatsApp con número de 10 dígitos
    Dado un pendiente "Luna" del cliente "Ana" con teléfono "3001234567"
    Cuando presiono "WhatsApp"
    Entonces se abre una pestaña nueva con "https://wa.me/573001234567?text=..."
    Y el mensaje incluye "Ana", "Pet Garden", "Luna" y la fecha de la última visita

  Escenario: Número que ya tiene indicativo
    Dado un pendiente con teléfono "+573001234567"
    Cuando presiono "WhatsApp"
    Entonces el enlace usa "573001234567" sin duplicar el 57

  Escenario: Agendar desde un pendiente
    Dado un pendiente "Luna" con teléfono "3001234567"
    Cuando presiono "Agendar"
    Entonces voy a la pantalla "Agendar cita"
    Y los campos mascota y teléfono vienen llenos
    Y la mascota existente se reconoce y se completan sus datos

  Escenario: Error al cargar
    Dado que no hay conexión con la base de datos
    Entonces en "Citas de hoy" veo "No hay conexión con la base de datos. Revisa tu internet y los datos de config.js."
```

## Novedades v3

### Reglas
1. **Descartar**: cada mascota de "A quién buscar" tiene el botón **Descartar**. La saca de la lista **solo en este ciclo**: cuando tenga un servicio nuevo y le vuelva a tocar, aparece otra vez.
2. Se guarda en `pendientes_descartados` (mascota, grupo y fecha del último servicio).
3. Tras descartar aparece el aviso con el botón **Deshacer** durante 7 segundos.
4. "Clientes por buscar" ya no cuenta a los descartados.
5. Casilla **"Ver descartados (N)"** para verlos y devolverlos con **"Volver a la lista"**.
6. Las citas **realizadas** de hoy tienen el botón **📲 Avisar** (WhatsApp para recoger la mascota).
7. Al **Terminar** una cita se abre "✔ Servicio terminado" con el botón **📲 Avisar por WhatsApp** (ver Feature 04).

```gherkin
# language: es
Característica: Descartar de "A quién buscar"

  Antecedentes:
    Dado que inicié sesión y estoy en "Hoy"
    Y "Simba" y "Luna" (de Ana) aparecen en "A quién buscar"

  Escenario: Descartar una mascota
    Cuando presiono "Descartar" en "Simba"
    Entonces "Simba" desaparece de la lista
    Y veo "Simba salió de la lista hasta su próximo servicio." con el botón "Deshacer"

  Escenario: Deshacer
    Dado que acabo de descartar a "Simba"
    Cuando presiono "Deshacer"
    Entonces "Simba" vuelve a la lista

  Escenario: Contador de clientes
    Dado que "Simba" y "Luna" son del mismo cliente
    Cuando descarto solo a "Simba"
    Entonces "Clientes por buscar" sigue contando a Ana una vez

  Escenario: Ver y restaurar descartados
    Dado que descarté a "Simba"
    Cuando marco "Ver descartados (1)"
    Entonces veo a "Simba" con el botón "Volver a la lista"
    Cuando lo presiono
    Entonces "Simba" vuelve a "A quién buscar"

  Escenario: Reaparece en el siguiente ciclo
    Dado que descarté a "Simba"
    Cuando "Simba" tiene un servicio nuevo y pasan sus 30 días
    Entonces vuelve a aparecer en "A quién buscar"

  Escenario: Avisar recogida desde Hoy
    Dado una cita de hoy en estado "realizada"
    Cuando presiono "📲 Avisar"
    Entonces se abre la ventana "✔ Servicio terminado" con el botón "📲 Avisar por WhatsApp"
```

## Novedades v4

1. Botones más pequeños y ordenados. En "Citas de hoy" hay una acción principal (Terminar o 📲 Avisar) y el menú **⋯** con Editar, Corregir y **Cancelar** (con motivo y registro; ver Feature 04).
2. En "A quién buscar", **Descartar** es el botón pequeño **✕** (al pasar el mouse dice "Descartar").
3. Una cita cancelada desde Hoy desaparece de "Citas de hoy" y queda en la Agenda con su registro.

```gherkin
# language: es
Característica: Hoy v4

  Escenario: Cancelar desde Hoy
    Dado una cita pendiente de hoy
    Cuando abro ⋯, elijo "✖ Cancelar cita" y doy un motivo
    Entonces la cita sale de "Citas de hoy"
    Y en la Agenda aparece cancelada con quién y por qué

  Escenario: Descartar con el botón ✕
    Cuando presiono ✕ en "Simba"
    Entonces "Simba" sale de "A quién buscar" y aparece "Deshacer"
```

## Novedades v5: mensajes de WhatsApp sin emojis

1. El recordatorio de "A quién buscar" ya no lleva emojis (mismo texto, sin íconos).
2. El aviso de servicio terminado dice exactamente: **"¡Hola, {cliente}! Ya puedes venir por {mascota} en Pet Garden. ¡Te esperamos!"** El nombre del negocio sale de `NOMBRE_NEGOCIO`.
3. La ventana "Servicio terminado" muestra el mensaje antes de enviarlo.

```gherkin
# language: es
Característica: Mensaje de recogida

  Escenario: Texto del mensaje
    Dado que terminé la cita de "Luna" (dueña Ana)
    Cuando presiono "Avisar por WhatsApp"
    Entonces WhatsApp se abre con el texto "¡Hola, Ana! Ya puedes venir por Luna en Pet Garden. ¡Te esperamos!"
    Y el mensaje no tiene emojis

  Escenario: Recordatorio sin emojis
    Cuando presiono "WhatsApp" en "A quién buscar"
    Entonces el mensaje no tiene emojis
```

## Nota sobre "A quién buscar" (v7)

La vista `pendientes` calcula, para cada mascota de un cliente activo y cada grupo de recordatorio, **último servicio terminado + días del grupo**. Si esa fecha ya pasó, la mascota aparece.

- Una mascota **sin servicios terminados** nunca aparece.
- Antes de la v7 el servicio guardaba el día en que se presionó "Terminar". Por eso las visitas viejas parecían recientes y casi nadie aparecía. Desde la v7 se guarda el día de la cita.

```gherkin
# language: es
Característica: Quién aparece en "A quién buscar"

  Esquema del escenario: Aparece o no según su último servicio
    Dado que hoy es 18/10/2026 y el grupo Spa es de 30 días
    Y el último servicio terminado de la mascota fue el <ultimo>
    Entonces la mascota <aparece> en "A quién buscar"

    Ejemplos:
      | ultimo     | aparece                         |
      | 30/06/2026 | aparece con 81 días de retraso  |
      | 18/09/2026 | aparece con "Toca hoy"          |
      | 10/10/2026 | no aparece                      |
      | (ninguno)  | no aparece                      |

  Escenario: Cliente inactivo
    Dado que el cliente está marcado como inactivo
    Entonces sus mascotas no aparecen aunque ya les toque
```

## Novedades v18 (ronda E2E · B02)

### Reglas
1. «A quién buscar» **no muestra** una mascota que ya tiene una **cita pendiente de hoy en adelante** para un servicio del **mismo grupo de recordatorio** (ej. Spa).
2. Una cita pendiente **sin servicio** cuenta para todos los grupos de esa mascota.
3. Si la cita se cancela o pasa su fecha sin terminarse, la mascota vuelve a aparecer.

```gherkin
# language: es
Característica: No buscar a quien ya agendó

  Escenario: Ya tiene cita del mismo grupo
    Dado que "Max" aparece en "A quién buscar" por el grupo Spa
    Cuando le agendo un "Corte y baño" para mañana
    Entonces "Max" ya no aparece en "A quién buscar"

  Escenario: Tiene cita de otro grupo
    Dado que "Max" debe volver por Spa
    Y tiene una cita pendiente de "Desparasitación" (otro grupo)
    Entonces "Max" sigue apareciendo en "A quién buscar" por Spa

  Escenario: La cita ya pasó sin terminarse
    Dado que "Max" tenía una cita de Spa ayer que nadie terminó
    Entonces "Max" vuelve a aparecer en "A quién buscar"
```

## Novedades v19: listas de Hoy más ordenadas

### Reglas
1. «A quién buscar hoy» muestra el total en el título y se divide en tres pestañas con su cantidad: **Hasta 30 días**, **1 a 3 meses** y **Más de 3 meses** (según los días de retraso).
2. Se abre en la primera pestaña que tenga mascotas. Las pestañas vacías se ven apagadas.
3. Se muestran **10 a la vez**; «Ver 10 más (quedan N)» carga las siguientes.
4. El buscador «Buscar mascota o dueño en la lista» busca en **toda** la lista (sin importar tildes ni mayúsculas) y apaga las pestañas mientras tenga texto.
5. Cada mascota es una tarjeta: nombre, etiqueta de retraso, y debajo dueño · grupo · último servicio. Los botones WhatsApp (verde), Agendar y ✕ van a la derecha si caben, o debajo.
6. Colores de la etiqueta: **Toca hoy** azul, hasta 30 días amarillo, más de 30 días rojo.
7. «Citas de hoy» usa el mismo diseño con la hora a la izquierda.

```gherkin
# language: es
Característica: A quién buscar sin una lista interminable

  Escenario: Se abre en lo más reciente
    Dado 12 mascotas con hasta 30 días de retraso, 30 con 1 a 3 meses y 58 con más de 3 meses
    Cuando abro Hoy
    Entonces el título dice "A quién buscar hoy (100)"
    Y está elegida la pestaña "Hasta 30 días (12)"
    Y veo 10 mascotas y el botón "Ver 2 más (quedan 2)"

  Escenario: Cambiar de tramo
    Cuando elijo "Más de 3 meses"
    Entonces veo las 10 primeras de ese tramo y "Ver 10 más (quedan 48)"

  Escenario: Buscar a alguien
    Cuando escribo "garzon" en el buscador de la lista
    Entonces veo las mascotas de "Sara Garzón" de cualquier tramo

  Escenario: Nadie coincide
    Cuando escribo "zzz"
    Entonces veo "Nadie coincide con «zzz»."
```
