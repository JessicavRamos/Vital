# Feature 04 · Agenda

## Historia de usuario

**Como** dueña de Pet Garden
**quiero** ver mis citas filtradas y cambiar su estado desde la misma lista
**para** registrar el servicio con un solo paso (marcar la cita como realizada) sin llenar dos formularios.

## Reglas de negocio

1. Filtros: **Hoy** (por defecto), **Próximos 7 días**, **Pendientes**, **Todas (últimas 100)**.
   - Hoy, 7 días y Pendientes: orden por fecha ascendente.
   - Todas: las 100 más recientes, orden descendente.
2. Columnas: Fecha y hora, Mascota (enlace a ficha), Dueño + teléfonos, Servicio (+ etiqueta "medicado" y guía), Precio, Estado, Acciones.
3. Acciones según el estado:

   | Estado | Acciones |
   |--------|----------|
   | pendiente | **Terminar** · menú ⋯ (Editar cita, Cancelar cita) |
   | realizada | **📲 Avisar** · menú ⋯ (Corregir servicio, Avisar que puede recogerlo, Cancelar servicio) |
   | cancelada | (ninguna: muestra quién la canceló, cuándo y por qué) |

4. **Terminar cita**:
   - La guía viene preseleccionada con la última usada en esa mascota.
   - Precio cobrado = precio acordado o, si no hay, el sugerido (editable).
   - Baño medicado solo si el servicio es Baño o Corte y baño.
   - Notas del servicio: máx. 300 caracteres.
   - Se hace **una sola actualización** a `citas` con `estado = realizada`; la base de datos crea el servicio en el historial.
5. **Editar cita** (solo pendientes): día, hora, servicio, precio acordado, baño medicado y motivo.
6. **Cancelar**: ver "Cancelaciones con registro (v4)". Nunca se borra la cita.
7. **Corregir servicio**: abre el editor del servicio creado por esa cita. Si no existe → "Esta cita no tiene un servicio asociado."

## Escenarios

```gherkin
# language: es
Característica: Agenda de citas

  Antecedentes:
    Dado que inicié sesión
    Y estoy en la pantalla "Agenda"

  Escenario: Filtro por defecto
    Entonces el filtro "Hoy" está seleccionado
    Y veo solo las citas de hoy ordenadas por hora

  Esquema del escenario: Filtros de la agenda
    Cuando selecciono el filtro "<filtro>"
    Entonces veo <resultado>

    Ejemplos:
      | filtro              | resultado                                              |
      | Próximos 7 días     | las citas desde hoy hasta dentro de 7 días             |
      | Pendientes          | solo citas en estado pendiente, de cualquier fecha     |
      | Todas (últimas 100) | máximo 100 citas, de la más reciente a la más antigua |

  Escenario: Sin citas para el filtro
    Dado que no hay citas pendientes
    Cuando selecciono "Pendientes"
    Entonces veo "No hay citas para este filtro."

  Esquema del escenario: Acciones según el estado
    Dado una cita en estado "<estado>"
    Entonces veo las acciones <acciones>

    Ejemplos:
      | estado    | acciones                                                                  |
      | pendiente | Terminar y ⋯ (Editar cita, Cancelar cita)                                 |
      | realizada | 📲 Avisar y ⋯ (Corregir servicio, Avisar que puede recogerlo, Cancelar servicio) |
      | cancelada | ninguna                                                                   |

  Escenario: Terminar una cita
    Dado una cita pendiente de "Toby" (Baño) con precio acordado $30.000
    Y la última guía usada en "Toby" fue la "#7"
    Cuando presiono "Terminar"
    Entonces la guía "#7" viene seleccionada con el texto "(viene la de la última vez)"
    Y el precio cobrado es $30.000
    Cuando escribo la nota "Se portó muy bien" y presiono "Marcar como realizada"
    Entonces se abre la ventana "✔ Servicio terminado"
    Y la cita aparece como "realizada"
    Y el servicio aparece en el historial de "Toby"

  Escenario: Terminar con baño medicado
    Dado una cita pendiente de "Baño" con precio $30.000
    Cuando presiono "Terminar" y marco "Baño medicado" con "+$8.000"
    Entonces el precio cobrado pasa a $38.000
    Y el servicio queda guardado como medicado con recargo $8.000

  Escenario: Terminar un corte no muestra medicado
    Dado una cita pendiente de "Corte"
    Cuando presiono "Terminar"
    Entonces no veo la casilla "Baño medicado"

  Escenario: Volver sin terminar
    Cuando abro "Terminar" y presiono "Volver"
    Entonces la ventana se cierra y la cita sigue pendiente

  Escenario: Editar una cita pendiente
    Dado una cita pendiente para mañana a las 10:00 a. m.
    Cuando presiono "Editar", cambio la hora a "3:30 p. m." y el servicio a "Corte y baño"
    Y presiono "Guardar cambios"
    Entonces veo "Cita actualizada."
    Y la cita se muestra a las 3:30 p. m. con servicio "Corte y baño"

  Escenario: Corregir el servicio de una cita realizada
    Dado una cita realizada con precio cobrado $30.000
    Cuando presiono "Corregir servicio" y cambio el precio a $32.000
    Entonces veo "Servicio actualizado."
    Y el historial muestra $32.000

  Escenario: Cita realizada sin servicio asociado
    Dado una cita realizada que no tiene servicio en el historial
    Cuando presiono "Corregir servicio"
    Entonces veo el aviso de error "Esta cita no tiene un servicio asociado."

  Escenario: Abrir ficha desde la agenda
    Cuando hago clic en el nombre de la mascota de una cita
    Entonces se abre la ficha con su historial en una ventana
    Y al cerrarla la agenda se recarga
```

## Novedades v3

### Reglas
1. La tabla se puede **ordenar y filtrar por columna** (ver README). Filtros de texto: fecha, mascota, dueño/teléfonos. Filtros de lista: servicio y estado.
2. **WhatsApp al terminar**: después de "Marcar como realizada" se abre "✔ Servicio terminado" con **📲 Avisar por WhatsApp**. El mensaje dice que la mascota ya está lista para recoger e incluye el nombre del negocio. Si el cliente no tiene teléfono, solo aparece "Cerrar".
3. ~~Eliminar cita~~ (v3) fue reemplazado en v4 por **Cancelar con registro**: ya no se borra nada.

```gherkin
# language: es
Característica: Agenda v3

  Antecedentes:
    Dado que inicié sesión y estoy en "Agenda"

  Escenario: Avisar por WhatsApp al terminar
    Dado una cita pendiente de "Luna" (dueña Ana, 3001234567)
    Cuando la marco como realizada
    Entonces veo "✔ Servicio terminado" y "¿Le avisas a Ana que ya puede recogerlo?"
    Cuando presiono "📲 Avisar por WhatsApp"
    Entonces se abre "https://wa.me/573001234567?text=..." con un mensaje que incluye "Ana", "Luna" y "Pet Garden"

  Escenario: Cerrar sin avisar
    Cuando termino una cita y presiono "Cerrar"
    Entonces no se abre WhatsApp y la cita queda realizada

  Escenario: Cliente sin teléfono
    Dado una cita cuyo dueño no tiene teléfono
    Cuando la termino
    Entonces veo "Este cliente no tiene teléfono guardado." y solo el botón "Cerrar"

```

## Novedades v4

### Cancelaciones con registro (reemplaza "Eliminar")
1. Nada se borra. Una cita se puede cancelar **en cualquier momento**, esté pendiente o ya realizada, desde el menú **⋯**.
2. Siempre se pide un **motivo** (obligatorio). Hay botones rápidos: "El cliente canceló", "El cliente no llegó", "Error al registrar", "Precio o servicio equivocado".
3. Queda registrado **quién canceló** (el nombre del usuario que inició sesión, o su correo), **cuándo** y **por qué**. El nombre lo pone la base de datos y no se puede escribir a mano.
4. **Cita pendiente cancelada**: pasa a estado `cancelada`.
5. **Servicio realizado cancelado**: la cita pasa a `cancelada` y su servicio se mueve a la bitácora `servicios_anulados`. Deja de contar en visitas, dinero, reportes y recordatorios.
6. En la Agenda, las citas canceladas se ven en gris, con el precio tachado y debajo "Por **Jessica** · 18/10/2026 10:32 a. m. · “motivo”". No tienen acciones.
7. Nadie puede borrar citas, servicios ni la bitácora desde el sitio: la base de datos lo bloquea.

### Botones compactos
8. Cada fila tiene **una acción principal** pequeña (Terminar o 📲 Avisar) y un botón **⋯** con las demás. El menú se abre encima de todo y se cierra con un clic afuera, con Esc o con otro clic en ⋯.

### Filtro de fecha
9. La columna "Fecha y hora" se muestra como **18/10/2026** y debajo **dom · 1:00 p. m.**
10. Su filtro es un **calendario**: muestra solo las citas del día elegido.

```gherkin
# language: es
Característica: Cancelaciones con registro

  Antecedentes:
    Dado que inicié sesión como "Jessica"
    Y estoy en "Agenda"

  Escenario: Cancelar una cita pendiente
    Dado una cita pendiente de "Luna"
    Cuando abro ⋯ y elijo "✖ Cancelar cita"
    Y elijo el motivo "El cliente no llegó"
    Y presiono "Sí, cancelar cita"
    Entonces veo "Cita cancelada. Quedó registrado quién la canceló."
    Y la cita aparece en gris como "cancelada"
    Y debajo dice "Por Jessica", la fecha y la hora, y "El cliente no llegó"

  Escenario: Cancelar un servicio ya realizado
    Dado una cita realizada de "Rocky" por $35.000
    Cuando abro ⋯ y elijo "✖ Cancelar servicio"
    Entonces veo el aviso de que dejará de contar en visitas, dinero, reportes y recordatorios
    Cuando escribo el motivo "Precio equivocado" y confirmo
    Entonces la cita queda "cancelada" con el precio tachado
    Y el servicio ya no suma en el historial de "Rocky" ni en los reportes
    Y aparece en la ficha de "Rocky" como "cancelado"

  Escenario: El motivo es obligatorio
    Cuando abro "Cancelar cita" y presiono "Sí, cancelar cita" sin motivo
    Entonces veo "Escribe o elige el motivo."
    Y la cita no cambia

  Escenario: Volver sin cancelar
    Cuando abro "Cancelar cita" y presiono "Volver"
    Entonces la cita sigue igual

  Escenario: Otro empleado cancela
    Dado que "Andrés" inició sesión en otro computador
    Cuando cancela una cita
    Entonces en la Agenda se ve "Por Andrés"

  Escenario: No se puede borrar desde fuera del sitio
    Cuando alguien intenta borrar una cita o un servicio directamente en la base de datos con la clave pública
    Entonces la base de datos lo rechaza

  Escenario: Cancelar dos veces
    Dado una cita ya cancelada
    Entonces no tiene botón ⋯ para cancelarla otra vez

Característica: Menú de acciones ⋯

  Escenario: Abrir y cerrar el menú
    Cuando presiono ⋯ en una cita pendiente
    Entonces veo "✏️ Editar cita" y "✖ Cancelar cita" (en rojo)
    Cuando hago clic fuera del menú o presiono Esc
    Entonces el menú se cierra

Característica: Filtro de fecha en la Agenda

  Escenario: Filtrar por un día
    Dado que estoy en "Todas (últimas 100)"
    Cuando elijo el 18/10/2026 en el calendario de "Fecha y hora"
    Entonces solo veo las citas de ese día

  Escenario: Quitar el filtro de fecha
    Cuando borro la fecha del filtro
    Entonces vuelvo a ver todas las citas

  Escenario: Formato de fecha y hora
    Entonces cada cita muestra la fecha como "dd/mm/aaaa"
    Y debajo el día de la semana y la hora, por ejemplo "dom · 1:00 p. m."
```

## Novedades v5: Agenda reorganizada

### Reglas
1. Arriba a la derecha hay tres vistas: **Día** (por defecto), **7 días** y **Buscar**.
2. **Día** y **7 días** tienen un navegador: **‹ [día que se ve] ›**, el botón **Volver a hoy** (solo si no estás en hoy) y un calendario para saltar a cualquier fecha (ver v6). "7 días" muestra el día elegido y los 6 siguientes, y avanza de 7 en 7.
3. Filtros rápidos por estado: **Todas · Pendientes · Realizadas · Canceladas**.
4. Resumen del rango: cantidad de citas, pendientes, realizadas, canceladas, **Cobrado** (realizadas) y **Por cobrar** (pendientes).
5. Cada cita es un renglón con la **hora grande**, mascota (enlace a la ficha), dueño y teléfono, servicio (medicado, guía, motivo), precio, estado y acciones. La franja de color a la izquierda indica el estado: amarillo pendiente, verde realizada, gris cancelada.
6. Las **canceladas** quedan recogidas al final de cada día ("2 canceladas"), salvo que se filtre por "Canceladas".
7. Un día sin citas muestra solo "No hay citas este día." (el botón "+ Agendar para este día" se quitó en v6).
8. En "7 días", el título de cada día abre ese día en la vista Día. El día de hoy se marca con "hoy".
9. **Buscar** es la tabla de las últimas 500 citas, con orden y filtros por columna (incluida la fecha con calendario) y **Limpiar filtros**.
10. Menú ⋯: pendiente → Editar cita, Ver ficha, **Cancelar cita**. Realizada → Corregir servicio, Avisar que puede recogerlo, Ver ficha, **Cancelar servicio (y su cita)**.
11. Si al cancelar la cita ya estaba cancelada (otra persona u otra pestaña se adelantó), se muestra "Esta cita ya estaba cancelada. Se actualizó la pantalla." y la lista se recarga. La lista siempre se recarga después de intentar cancelar, para mostrar el estado real.

```gherkin
# language: es
Característica: Agenda por día y 7 días

  Escenario: Vista por defecto
    Cuando abro "Agenda"
    Entonces veo la vista "Día" con el título "Hoy · Domingo, 18 de octubre"
    Y el resumen con citas, pendientes, realizadas, cobrado y por cobrar

  Escenario: Moverse entre días
    Cuando presiono ›
    Entonces veo "Mañana · Lunes, 19 de octubre"
    Cuando presiono "Volver a hoy"
    Entonces vuelvo al día de hoy

  Escenario: Ir a una fecha
    Cuando elijo el 25/10/2026 en el calendario
    Entonces veo las citas de ese día

  Escenario: Ver 7 días
    Cuando elijo "7 días"
    Entonces veo de hoy a 6 días después, agrupado por día y ordenado por hora
    Y los días sin citas dicen "sin citas"

  Escenario: Filtrar por estado
    Cuando presiono "Pendientes"
    Entonces solo veo citas pendientes y el resumen sigue mostrando todo el rango

  Escenario: Canceladas recogidas
    Dado que hoy hay 2 citas canceladas
    Entonces al final del día veo "2 canceladas" cerrado
    Cuando lo abro
    Entonces veo cada una con quién la canceló, cuándo y por qué

  Escenario: Día sin citas
    Dado un día sin citas
    Entonces veo "No hay citas este día."
    Y no hay ningún botón para agendar

  Escenario: Cancelar un servicio realizado cancela también su cita
    Dado una cita realizada de "Rocky"
    Cuando abro ⋯, elijo "Cancelar servicio (y su cita)" y doy un motivo
    Entonces veo "Servicio y cita cancelados. Quedó registrado quién los canceló."
    Y la cita queda en "canceladas"
    Y el servicio deja de contar

  Escenario: Cancelar algo que ya estaba cancelado
    Dado que otra persona ya canceló la cita
    Cuando intento cancelarla desde una pantalla vieja
    Entonces veo "Esta cita ya estaba cancelada. Se actualizó la pantalla."
```

## Novedades v6

### Reglas
1. El texto del centro del navegador dice **qué día se está viendo**: "Hoy", "Mañana", "Ayer" o "Vie 16/10". En "7 días" dice "Desde hoy" o "Desde 16/10".
2. El botón **Volver a hoy** aparece solo cuando no se está viendo el día de hoy.
3. Ya no existe "+ Agendar para este día".
4. Todos los campos de fecha usan el calendario propio (ver README, "Calendario").

```gherkin
# language: es
Característica: Navegador de días

  Esquema del escenario: Texto del centro
    Dado que estoy en la vista "Día"
    Cuando me muevo <movimiento>
    Entonces el centro dice "<texto>"
    Y el botón "Volver a hoy" <visible>

    Ejemplos:
      | movimiento               | texto     | visible       |
      | a hoy                    | Hoy       | no aparece    |
      | un día adelante (›)      | Mañana    | aparece       |
      | un día atrás (‹)         | Ayer      | aparece       |
      | al viernes 16/10         | Vie 16/10 | aparece       |

  Escenario: Volver a hoy
    Dado que estoy viendo el 25/10/2026
    Cuando presiono "Volver a hoy"
    Entonces el centro dice "Hoy" y veo las citas de hoy
```

## Novedades v7: el servicio guarda la fecha de la cita

### Reglas
1. Al presionar **Terminar**, el servicio se guarda con el **día de la cita** (pasada o futura), no con el día en que se presionó el botón.
2. La cita conserva su fecha y hora.
3. Si la cita no tuviera fecha, se usa la fecha de hoy.
4. Corregir la fecha de un servicio ("Editar servicio") sigue moviendo su cita a esa misma fecha.
5. Los servicios guardados antes con la fecha equivocada se corrigieron con el SQL v7 (paso 4). Las visitas viejas que se cargaron con fecha 10/10 necesitan la fecha real del registro del negocio.

```gherkin
# language: es
Característica: Fecha del servicio = fecha de la cita

  Escenario: Terminar hoy una cita pasada
    Dado una cita pendiente de "Zeus" para el 03/08/2026 a las 10:00 a. m.
    Cuando la termino hoy, 18/10/2026
    Entonces el servicio queda con fecha 03/08/2026
    Y la cita sigue el 03/08/2026 a las 10:00 a. m.
    Y "A quién buscar" calcula el regreso desde el 03/08/2026

  Escenario: Terminar una cita futura
    Dado una cita de "Luna" para el 25/10/2026
    Cuando la termino hoy
    Entonces el servicio queda con fecha 25/10/2026

  Escenario: Cargar visitas anteriores
    Dado que quiero registrar una visita del 15/07/2026
    Cuando en Agendar elijo el día 15/07/2026 y la hora de la visita, y luego la termino
    Entonces el historial muestra el servicio del 15/07/2026
```

## Novedades v9: recordatorio de citas pendientes y mensajes en 3 renglones

### Reglas
1. Cada cita **pendiente** tiene el botón **Recordar** (en Agenda y en Hoy), y también está en el menú ⋯ como "Enviar recordatorio por WhatsApp".
2. Antes de abrir WhatsApp se muestra el mensaje para revisarlo, con el nombre y el teléfono del dueño.
3. El recordatorio lleva el primer nombre del dueño, la mascota, el servicio, el día y la hora. El día dice "hoy", "mañana" o "el viernes 23 de octubre" según corresponda.
4. Todos los mensajes van en 3 renglones: saludo y mensaje, un renglón vacío, y "¡Te esperamos!".
5. Si el cliente no tiene teléfono, solo aparece "Cerrar".

```gherkin
# language: es
Característica: Mensajes de WhatsApp por cita

  Esquema del escenario: Recordatorio de una cita pendiente
    Dado que hoy es 18/10/2026
    Y una cita pendiente de "<mascota>" (<servicio>) de "<dueño>" el <fecha> a las <hora>
    Cuando presiono "Recordar" y luego "Enviar recordatorio"
    Entonces WhatsApp se abre con el mensaje:
      """
      ¡Hola, <nombre>! Te recordamos la cita de <mascota> (<servicio>) en Pet Garden <cuando> a las <hora>

      ¡Te esperamos!
      """

    Ejemplos:
      | dueño                | nombre | mascota | servicio     | fecha      | hora        | cuando                       |
      | Ana                  | Ana    | Luna    | baño         | 18/10/2026 | 9:00 a. m.  | hoy                          |
      | Jessi                | Jessi  | Max     | uñas         | 19/10/2026 | 10:00 a. m. | mañana                       |
      | Maria de los Angeles | Maria  | Toby    | corte y baño | 23/10/2026 | 2:30 p. m.  | el viernes 23 de octubre     |

  Escenario: Aviso de recogida en 3 renglones
    Dado que terminé la cita de "Max" de "Jessi"
    Cuando presiono "Avisar por WhatsApp"
    Entonces WhatsApp se abre con el mensaje:
      """
      ¡Hola, Jessi! Ya puedes venir por Max en Pet Garden.

      ¡Te esperamos!
      """

  Escenario: Revisar antes de enviar
    Cuando presiono "Recordar"
    Entonces veo el mensaje completo, el nombre y el teléfono del dueño
    Y WhatsApp solo se abre si presiono "Enviar recordatorio"

## Novedades v13

1. **Buscar** trae **todas** las citas (antes las últimas 500).
2. Las fechas se ven en un solo formato: `dd/mm/aaaa` (también en Hoy, Agendar y Reportes). En los mensajes de WhatsApp se escribe "15 de marzo".
