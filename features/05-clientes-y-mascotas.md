# Feature 05 · Clientes y mascotas

## Historia de usuario

**Como** dueña de Pet Garden
**quiero** buscar cualquier mascota o cliente, ver su ficha y su historial y corregir sus datos
**para** tener la información siempre al día y saber cómo le gusta el corte a cada cliente.

## Reglas de negocio

1. Búsqueda por **mascota, dueño, teléfono o segundo teléfono**; se actualiza mientras escribo (300 ms).
2. Máximo **1.000 resultados**, ordenados por nombre de mascota. La tabla se puede **ordenar y filtrar por columna** (Mascota, Especie, Raza, Dueño, Teléfonos, Visitas, Última visita).
3. Los clientes **inactivos** se ocultan salvo que marque "Mostrar clientes inactivos".
4. Columnas: Mascota (+ raza/especie y "inactivo"), Dueño, Teléfonos, Visitas, Última visita.
5. Si llego desde el buscador general y hay **una sola coincidencia**, la ficha se abre sola.
6. La fila de la mascota abierta queda resaltada.
7. **Ficha editable**:
   - Mascota: nombre (obligatorio), especie, raza (filtrada por especie), descripción del corte.
   - Dueño: nombre (obligatorio), teléfono (obligatorio), segundo teléfono, notas.
   - Al cambiar la especie se reinicia la lista de razas.
8. **Activo / inactivo**: pide confirmación. Un cliente inactivo deja de salir en "A quién buscar" pero conserva su historial.
9. **Historial**: hasta 60 servicios, del más reciente al más antiguo; muestra servicio, "medicado", fecha, guía, notas y precio. Opción "Incluir las demás mascotas del cliente".
10. **Editar servicio** del historial: tipo, fecha, guía, precio cobrado, baño medicado y notas.
11. Si la ficha está abierta en ventana (desde Hoy o Agenda), al guardar o cambiar el estado la ventana se cierra.

## Escenarios

```gherkin
# language: es
Característica: Clientes y mascotas

  Antecedentes:
    Dado que inicié sesión
    Y estoy en "Clientes y mascotas"

  Escenario: Lista inicial
    Entonces veo hasta 100 mascotas de clientes activos ordenadas por nombre

  Esquema del escenario: Buscar por distintos datos
    Cuando escribo "<termino>" en el buscador
    Entonces veo a "Luna" en los resultados

    Ejemplos:
      | termino    |
      | Lun        |
      | Ana        |
      | 3001234567 |
      | 3159998877 |

  Escenario: Sin coincidencias
    Cuando busco "zzzz"
    Entonces veo "No encontré coincidencias."

  Escenario: Mostrar clientes inactivos
    Dado que "Max" pertenece a un cliente inactivo
    Entonces "Max" no aparece en la lista
    Cuando marco "Mostrar clientes inactivos"
    Entonces "Max" aparece con la marca "inactivo"

  Escenario: Abrir la ficha
    Cuando hago clic en "Luna"
    Entonces veo su ficha con los datos de la mascota y del dueño
    Y la etiqueta "cliente activo"
    Y su historial de servicios

  Escenario: Editar datos de la mascota y del dueño
    Dado que tengo abierta la ficha de "Luna"
    Cuando cambio la descripción del corte a "Guía 7 en el cuerpo, cara redonda"
    Y agrego el segundo teléfono "3159998877"
    Y presiono "Guardar cambios"
    Entonces veo "Cambios guardados."
    Y la ficha muestra los datos nuevos

  Escenario: Teléfono obligatorio
    Dado que tengo abierta una ficha
    Cuando borro el teléfono principal y guardo
    Entonces veo "El teléfono es obligatorio."

  Escenario: Teléfono repetido
    Cuando cambio el teléfono a uno que ya tiene otro cliente y guardo
    Entonces veo "Ya existe un registro con ese dato (por ejemplo, otro cliente con ese teléfono o una raza repetida)."

  Escenario: Cambiar especie reinicia la raza
    Dado que "Luna" es perro con raza "Criollo"
    Cuando cambio la especie a "Gato"
    Entonces la lista de razas solo muestra razas de gato y ninguna queda seleccionada

  Escenario: Marcar cliente como inactivo
    Cuando presiono "Marcar cliente inactivo"
    Entonces se pide confirmación indicando que dejará de salir en "a quién buscar"
    Cuando acepto
    Entonces veo "Cliente marcado como inactivo."
    Y el botón cambia a "Reactivar cliente"

  Escenario: Reactivar cliente
    Dado un cliente inactivo
    Cuando presiono "Reactivar cliente" y acepto
    Entonces veo "Cliente reactivado."

  Escenario: Historial de todas las mascotas del cliente
    Dado que "Ana" tiene a "Luna" y a "Simba"
    Y tengo abierta la ficha de "Luna"
    Cuando marco "Incluir las demás mascotas del cliente"
    Entonces veo los servicios de "Luna" y de "Simba" con el nombre de cada mascota

  Escenario: Mascota sin servicios
    Dado una mascota sin servicios
    Entonces en el historial veo "Todavía no tiene servicios registrados."

  Escenario: Editar un servicio del historial
    Cuando presiono "Editar" en un servicio
    Y cambio la guía y el precio
    Y presiono "Guardar"
    Entonces veo "Servicio actualizado." y el historial se actualiza

  Escenario: Ficha abierta en ventana se cierra al guardar
    Dado que abrí la ficha de "Luna" desde la pantalla "Hoy"
    Cuando guardo cambios
    Entonces la ventana se cierra y la pantalla "Hoy" se recarga

  Escenario: Abrir ficha automáticamente desde el buscador general
    Cuando busco "Simba" en el buscador superior y presiono Enter
    Y "Simba" es la única coincidencia
    Entonces su ficha se abre sola
```

## Novedades v3

### Reglas
1. Encima del historial se muestra **"N servicios · Total $X"** (con o sin las demás mascotas del cliente).
2. ~~Eliminar servicio~~ (v3) fue reemplazado en v4 por **Cancelar servicio** (ver abajo).

```gherkin
# language: es
Característica: Clientes y mascotas v3

  Escenario: Total del historial
    Dado que "Luna" tiene 12 servicios que suman $488.000
    Cuando abro su ficha
    Entonces veo "12 servicios · Total $488.000"

  Escenario: Filtrar la lista por especie
    Cuando elijo "gato" en el filtro de "Especie"
    Entonces solo veo gatos
```

## Novedades v4

### Reglas
1. En "Editar servicio" el botón rojo es **Cancelar servicio**. Pide motivo, registra quién y cuándo, y el servicio deja de contar (visitas, total, reportes y recordatorios). Si salió de una cita, la cita queda "cancelada".
2. El historial de la ficha muestra los **servicios cancelados** tachados, con la etiqueta "cancelado", quién lo canceló, cuándo y el motivo. **No suman** en el total ni en las visitas.
3. Casilla **"Ver cancelados (N)"**, marcada por defecto, para mostrarlos u ocultarlos.
4. Botones del historial más pequeños ("Editar").
5. Fechas en formato **dd/mm/aaaa**. "Última visita" se filtra con **calendario**.
6. En celular, al tocar una mascota la pantalla baja sola hasta su ficha.

```gherkin
# language: es
Característica: Servicios cancelados en la ficha

  Escenario: Cancelar un servicio desde el historial
    Dado que "Luna" tiene 12 servicios por $488.000
    Cuando abro "Editar" en el servicio de $48.000 y presiono "Cancelar servicio"
    Y escribo el motivo "Precio equivocado" y confirmo
    Entonces veo "Servicio cancelado. Quedó registrado quién lo canceló."
    Y el historial dice "11 servicios · Total $440.000"
    Y el servicio aparece tachado con "cancelado", "Por Jessica", la fecha y la hora, y "Precio equivocado"

  Escenario: Ocultar los cancelados
    Cuando desmarco "Ver cancelados (1)"
    Entonces el servicio cancelado deja de verse
    Y el total no cambia

  Escenario: Los cancelados no cuentan como visita
    Dado que a "Luna" le cancelaron un servicio
    Entonces en la lista "Visitas" no lo cuenta
    Y en "Agendar" no aparece en "Servicios terminados"
```

## Novedades v6

1. Quien cancela un servicio queda registrado como **"Nombre (correo)"**, por ejemplo "Jessica (jessica@correo.com)". El correo sale de la cuenta con la que se inició sesión, así que no se puede cambiar como el nombre del perfil.
2. La ventana de cancelar muestra antes de confirmar el nombre y el correo que quedarán guardados.
3. Las fechas del formulario "Editar servicio" usan el calendario propio.

## Novedades v13

### Reglas
1. La lista trae **todas** las mascotas (antes máximo 1.000) y la ficha **todo** el historial (antes 60), así el total cobrado es correcto.
2. Botón **Registrar visita anterior** en el historial de la ficha: para servicios que se hicieron antes de usar el sistema (o que se olvidó registrar).
   - Campos: fecha (obligatoria, **no puede ser futura**), hora, servicio, precio cobrado (se sugiere el de la raza), guía, notas y baño medicado (solo Baño y Corte y baño).
   - Se crea la cita ya **realizada** en esa fecha y su servicio con **esa misma fecha**; cuenta para "A quién buscar" y para Reportes.
   - Necesita el SQL v10 (función `registrar_visita_anterior`).
3. "Marcar cliente inactivo" y "Reactivar" se confirman en una ventana propia (no la del navegador).
4. Si la base no deja guardar los cambios de la ficha, se muestra el error en vez de "Cambios guardados.".

```gherkin
# language: es
Característica: Visita anterior

  Escenario: Registrar una visita que se hizo antes del sistema
    Dado que abro la ficha de "Akira", que no tiene servicios
    Cuando presiono "Registrar visita anterior"
    Y elijo la fecha 15/03/2026, el servicio "Baño" y el precio 30000
    Y presiono "Guardar visita"
    Entonces veo "Visita del 15/03/2026 guardada en el historial de Akira."
    Y el historial muestra el baño del 15/03/2026
    Y "Akira" aparece en "A quién buscar" cuando se cumplan los días del grupo

  Escenario: Fecha futura
    Cuando elijo una fecha de la próxima semana y presiono "Guardar visita"
    Entonces veo "La fecha no puede ser futura. Para eso usa Agendar."

  Escenario: Más de 1.000 mascotas
    Dado que hay 1.203 mascotas registradas
    Cuando abro Clientes
    Entonces veo "Mostrando 1203 de 1203 registros"
```
