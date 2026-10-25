# Feature 06 · Catálogos

## Historia de usuario

**Como** dueña de Pet Garden
**quiero** administrar los precios por raza, las guías de la máquina, los servicios con sus recordatorios y el logo
**para** que el sistema sugiera precios correctos, recuerde cuándo vuelve cada cliente y muestre la marca del negocio.

## Reglas de negocio

1. Pestañas: **Razas y precios**, **Guías**, **Servicios y recordatorios**, **Logo del negocio**.
2. En las tablas, **cada celda se guarda sola al cambiarla** (aviso "Guardado.").
3. Un campo de texto obligatorio no puede quedar vacío → "Este campo no puede quedar vacío." y se recarga el valor anterior.

### Razas y precios
4. Campos: Raza (obligatorio), Especie, Baño, Corte, Corte y baño, **Uñas** (v6). La columna "Recargo medicado" se quitó en v6 (los datos siguen guardados, pero ya no se muestran ni se usan).
5. La especie de una raza existente no se edita en la tabla.
6. Quitar una raza pide confirmación: "las mascotas que la tengan quedarán sin raza".
7. Raza repetida → mensaje de registro duplicado.

### Guías
8. Campos: Número de guía (obligatorio) y descripción (opcional). Son las opciones del desplegable "Guía usada".
9. Quitar una guía pide confirmación: "los servicios que la usaron quedarán sin guía".

### Servicios y recordatorios
10. **No se pueden renombrar** "Baño", "Corte", "Corte y baño" ni "Uñas" (campo deshabilitado): el precio sugerido depende de esos nombres.
11. Grupos de recordatorio: nombre y **días para volver** (número **mayor que 0**). Ej. *Spa* = 30 días.
12. Cada servicio pertenece a un grupo; los servicios de un mismo grupo cuentan igual para el recordatorio.

### Logo
13. Formatos: **PNG, JPG, WEBP, SVG**. Tamaño máximo **2 MB**.
14. Se sube al bucket `logo` como `logo-<timestamp>.<ext>` y se **borran los logos anteriores**.
15. Al subirlo se ve de inmediato en el menú y en el login.

## Escenarios

```gherkin
# language: es
Característica: Catálogos

  Antecedentes:
    Dado que inicié sesión
    Y estoy en "Catálogos"

  Escenario: Pestaña por defecto
    Entonces la pestaña "Razas y precios" está seleccionada

  # ---------- Razas ----------
  Escenario: Agregar una raza
    Cuando escribo raza "Schnauzer", especie "Perro", baño 35000, corte 40000, corte y baño 60000, uñas 10000
    Y presiono "Agregar raza"
    Entonces veo "Agregado." y "Schnauzer" aparece en la tabla

  Escenario: Raza repetida
    Dado que ya existe la raza "Schnauzer" para perro
    Cuando intento agregarla de nuevo
    Entonces veo un mensaje de registro duplicado

  Escenario: Editar un precio en la tabla
    Cuando cambio el precio de baño de "Criollo" a 32000 y salgo del campo
    Entonces veo "Guardado."
    Y al agendar un baño para un Criollo nuevo se sugiere $32.000

  Escenario: Nombre de raza vacío
    Cuando borro el nombre de una raza y salgo del campo
    Entonces veo "Este campo no puede quedar vacío."
    Y se recupera el nombre anterior

  Escenario: Quitar una raza
    Cuando presiono "Quitar" en una raza
    Entonces se pide confirmación indicando que las mascotas quedarán sin raza
    Cuando acepto
    Entonces veo "Eliminado."

  # ---------- Guías ----------
  Escenario: Agregar una guía
    Dado que estoy en la pestaña "Guías"
    Cuando escribo "#10" y la descripción "Máquina Andis"
    Y presiono "Agregar guía"
    Entonces "#10" aparece en la tabla
    Y aparece como opción en "Guía usada" al terminar una cita

  Escenario: Quitar una guía
    Cuando presiono "Quitar" en una guía y acepto
    Entonces la guía desaparece y los servicios que la usaron quedan sin guía

  # ---------- Servicios ----------
  Escenario: Servicios fijos no se pueden renombrar
    Dado que estoy en "Servicios y recordatorios"
    Entonces veo el aviso "No cambies el nombre de Baño, Corte, Corte y baño"
    Y los nombres "Baño", "Corte" y "Corte y baño" están deshabilitados

  Escenario: Agregar un grupo de recordatorio
    Cuando agrego el grupo "Desparasitación" con 90 días
    Entonces veo "Agregado." y el grupo aparece en la tabla

  Esquema del escenario: Días para volver inválidos
    Cuando cambio los días de un grupo a "<valor>"
    Entonces veo "Los días deben ser un número mayor que 0."

    Ejemplos:
      | valor |
      | 0     |
      | -5    |
      |       |

  Escenario: Agregar un servicio a un grupo
    Cuando agrego el servicio "Antipulgas" en el grupo "Desparasitación"
    Entonces aparece en la tabla de servicios
    Y está disponible al agendar una cita

  Escenario: Cambiar el grupo de un servicio
    Cuando cambio el grupo de un servicio en la tabla
    Entonces veo "Guardado."

  # ---------- Logo ----------
  Escenario: Subir logo válido
    Dado que estoy en "Logo del negocio"
    Cuando elijo un PNG de 500 KB y presiono "Subir logo"
    Entonces veo "Logo actualizado."
    Y veo el nuevo logo en el menú lateral
    Y los logos anteriores se eliminan del bucket

  Escenario: Formato de logo no permitido
    Cuando elijo un archivo GIF
    Entonces veo "Usa una imagen PNG, JPG, WEBP o SVG."

  Escenario: Logo demasiado pesado
    Cuando elijo una imagen de 3 MB
    Entonces veo "La imagen pesa más de 2 MB. Usa una más liviana."

  Escenario: Sin logo subido
    Dado que nunca he subido un logo
    Entonces veo "Todavía no has subido un logo."
```

## Novedades v6: servicio Uñas

### Reglas
1. Existe el servicio **Uñas** (lo crea el SQL v6) con su propio grupo de recordatorio **"Uñas"** (30 días, editable). Así cortar uñas no reinicia el recordatorio del baño (grupo *Spa*).
2. En **Razas y precios** hay una columna **Uñas** con el precio por raza (`razas.precio_unas`).
3. En **Agendar**, "Uñas" aparece en la lista de servicios y sugiere el precio de uñas de la raza. Si la mascota ya pagó uñas antes, se sugiere su último precio.
4. "Uñas" no muestra la casilla de baño medicado.

```gherkin
# language: es
Característica: Servicio Uñas

  Escenario: Precio de uñas por raza
    Dado que en "Razas y precios" escribo 10000 en la columna "Uñas" de "Criollo"
    Cuando en Agendar elijo una mascota Criollo y el servicio "Uñas"
    Entonces el precio sugerido es $10.000
    Y no aparece la casilla "Baño medicado"

  Escenario: Columnas de razas
    Cuando abro "Razas y precios"
    Entonces veo las columnas Raza, Especie, Baño, Corte, Corte y baño y Uñas
    Y no veo "Recargo medicado"

  Escenario: Recordatorio separado
    Dado que "Luna" tuvo baño el 01/09 y uñas el 15/10
    Entonces el recordatorio de Spa se calcula desde el 01/09
    Y el de Uñas desde el 15/10
```

## Novedades v11

1. La pestaña **Razas y precios** solo la puede editar el **administrador**. El empleado ve la lista de precios en modo lectura (ver Feature 09).
2. Guías, Servicios y recordatorios, y Logo siguen disponibles para los dos roles.

## Novedades v13

1. **Servicios y recordatorios** y **Logo del negocio** solo los cambia el **administrador** (el colaborador ve los servicios y los días en modo lectura, y el logo actual). Lo protege también la base (SQL v10).
2. **Guías** siguen disponibles para los dos roles.
3. "Quitar" una raza o una guía se confirma en una **ventana propia** (botones Volver / Sí, quitar) en vez de la del navegador.
4. Si se renombra un grupo (ej. "Spa"), las mascotas descartadas en "A quién buscar" siguen descartadas.

```gherkin
# language: es
Característica: Catálogos por rol (v13)

  Escenario: Colaborador en Servicios y recordatorios
    Dado que inicié sesión como colaborador
    Cuando abro "Servicios y recordatorios"
    Entonces veo "Solo el administrador puede cambiar los servicios y los recordatorios."
    Y no hay campos para editar

  Escenario: Colaborador en Logo
    Dado que inicié sesión como colaborador
    Cuando abro "Logo del negocio"
    Entonces veo el logo actual y "Solo el administrador puede cambiar el logo."
    Y no veo el botón "Subir logo"

  Escenario: Confirmación propia
    Cuando presiono "Quitar" en una guía
    Entonces se abre una ventana con "Volver" y "Sí, quitar"
    Cuando presiono "Volver"
    Entonces la guía sigue en la tabla
```
