# Feature 09 · Usuarios y roles

## Historia de usuario

**Como** administradora de Pet Garden
**quiero** que cada persona entre con un rol (administrador o empleado)
**para** que los empleados trabajen en el día a día sin ver los Reportes ni administrar usuarios.

## Reglas de negocio

1. Hay dos roles: **Administrador** y **Colaborador** (en la base se guarda como `empleado`; en pantalla se muestra "Colaborador"). Se guardan en la tabla `perfiles` (uno por cada usuario de Supabase Auth).
2. Todo usuario nuevo creado en Supabase (Authentication → Users) aparece solo como **Colaborador**.
3. El nombre del perfil se actualiza solo cuando la persona lo cambia en "Escribe tu nombre".
4. Permisos:

   | Acción | Administrador | Colaborador |
   |---|---|---|
   | Hoy, Agendar, Agenda, Clientes y mascotas | ✔ | ✔ |
   | Ver precios | ✔ | ✔ |
   | Cancelar citas y servicios | ✔ | ✔ |
   | Catálogos: guías, servicios y logo | ✔ | ✔ |
   | **Catálogos: razas y precios** (agregar, cambiar, quitar) | ✔ | ✖ (solo ve la lista) |
   | Subir, editar y activar/desactivar videos | ✔ | ✔ |
   | **Borrar videos** | ✔ | ✖ |
   | **Reportes y Excel** | ✔ | ✖ |
   | **Usuarios (cambiar roles)** | ✔ | ✖ |

5. Al empleado no le aparecen "Reportes" ni "Usuarios" en el menú. Si entra por la dirección (`#/reportes`), vuelve a Hoy con el aviso "Esa sección es solo para el administrador."
6. La base de datos también lo hace cumplir:
   - Solo el administrador puede cambiar roles. Nadie puede subirse de rol a sí mismo.
   - Solo el administrador puede borrar videos, tanto de la tabla como del almacenamiento.
   - Solo el administrador puede agregar, cambiar o quitar razas y sus precios (SQL v9).
   - Siempre debe quedar al menos un administrador: "Debe quedar al menos un administrador."
7. Si un empleado reemplaza el archivo de un video, el archivo anterior se conserva en el almacenamiento.
8. Abajo del menú se muestra el nombre y el rol de quien inició sesión.
9. Si el SQL de roles (v8) aún no se ha ejecutado, todos tienen acceso completo y la pantalla Usuarios lo avisa.
10. Limitación conocida: Reportes se oculta en el sitio, pero sus datos (citas, servicios, precios) son los mismos que el empleado necesita para trabajar, así que no se bloquean en la base de datos.

## Escenarios

```gherkin
# language: es
Característica: Roles y usuarios

  Escenario: Menú del administrador
    Dado que inicié sesión como administrador
    Entonces el menú tiene Hoy, Agendar, Agenda, Clientes y mascotas, Reportes, Catálogos, Videos y Usuarios
    Y abajo del menú dice mi nombre y "Administrador"

  Escenario: Menú del empleado
    Dado que inicié sesión como empleado
    Entonces el menú no tiene "Reportes" ni "Usuarios"
    Y abajo del menú dice mi nombre y "Colaborador"

  Esquema del escenario: El empleado no entra a secciones de administrador por la dirección
    Dado que inicié sesión como empleado
    Cuando abro "<direccion>"
    Entonces vuelvo a "Hoy"
    Y veo "Esa sección es solo para el administrador."

    Ejemplos:
      | direccion   |
      | #/reportes  |
      | #/usuarios  |

  Escenario: El empleado puede cancelar
    Dado que inicié sesión como empleado
    Cuando cancelo un servicio realizado con un motivo
    Entonces queda cancelado con mi nombre y correo

  Escenario: Videos para el empleado
    Dado que inicié sesión como empleado
    Cuando abro "Videos"
    Entonces puedo agregar, editar y activar o desactivar videos
    Pero no veo el botón "Borrar"

  Escenario: Usuario nuevo
    Dado que creé a "andres@correo.com" en Supabase → Authentication → Users
    Cuando abro "Usuarios"
    Entonces aparece "andres@correo.com" con rol "Colaborador"

  Escenario: Cambiar el rol de un usuario
    Dado que soy administrador y estoy en "Usuarios"
    Cuando cambio a "Andrés" a "Administrador" y confirmo
    Entonces veo "Andrés ahora es administrador."
    Y la próxima vez que Andrés entre verá Reportes y Usuarios

  Escenario: No quedarse sin administrador
    Dado que soy el único administrador
    Cuando intento cambiarme a "Colaborador"
    Entonces veo "Debe quedar al menos un administrador."
    Y sigo siendo administrador

  Escenario: Un empleado no puede subirse de rol
    Dado que soy empleado
    Cuando intento cambiar mi rol directamente en la base de datos
    Entonces la base de datos no lo permite

  Escenario: Cancelar el cambio de rol
    Cuando cambio un rol y no confirmo
    Entonces la lista vuelve al rol anterior
```

## Novedades v11: precios solo para el administrador

```gherkin
# language: es
Característica: Razas y precios según el rol

  Escenario: El empleado ve los precios sin poder cambiarlos
    Dado que inicié sesión como empleado
    Cuando abro Catálogos → "Razas y precios"
    Entonces veo "Solo el administrador puede cambiar los precios y las razas."
    Y veo la lista de razas con sus precios en pesos
    Pero no veo campos para editar, ni "Agregar raza", ni "Quitar"

  Escenario: La base de datos protege los precios
    Dado que soy empleado
    Cuando intento cambiar un precio directamente en la base de datos
    Entonces el precio no cambia

  Escenario: El administrador sigue editando
    Dado que inicié sesión como administrador
    Cuando cambio el precio de baño de "Criollo" a 32000
    Entonces veo "Guardado."
```

## Novedades v13

| Acción | Administrador | Colaborador |
|---|---|---|
| Guías | ✔ | ✔ |
| Precios por raza, servicios, recordatorios y logo | ✔ | Solo ver |
| Leer datos sin iniciar sesión | — | — (solo la página pública de videos) |

- Cambiar el rol se confirma en una ventana propia.
- Nota: el colaborador ve los precios de cada cita (así se pidió), por eso los ingresos se podrían calcular a mano. La pantalla Reportes y el Excel siguen siendo solo del administrador.
