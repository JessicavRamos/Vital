# Feature 11 · Sedes y planes (DALU Vital)

Cada negocio tiene un **plan** que le asigna DALU y puede tener varias **sedes**.
La parte de pagos y Suscripción está en [10-multinegocio.md](10-multinegocio.md).

## Historias de usuario

**Como** DALU (dueña del producto)
**quiero** asignar a cada empresa un plan con límites de sedes, usuarios y módulos
**para** cobrar según lo que cada cliente usa y ofrecerle crecer.

**Como** administradora de una empresa con varias sedes
**quiero** que cada sede tenga su agenda y sus precios, y que mis clientes puedan ir a cualquier sede
**para** organizar el trabajo de cada local sin duplicar clientes ni mascotas.

**Como** colaborador
**quiero** ver solo las sedes donde trabajo
**para** no confundirme con la agenda de otro local.

## Reglas de negocio

### Planes
1. Hay tres planes (los nombres y valores se editan en *Negocios · DALU → Planes*):

   | | Esencial | Profesional | Premium |
   |---|---|---|---|
   | Sedes activas | 1 | 2 | 5 |
   | Usuarios (cuentas + invitaciones pendientes) | 3 | 8 | 20 |
   | Recordatorios (A quién buscar + WhatsApp) | ✔ | ✔ | ✔ |
   | Reportes y Excel | ✔ | ✔ | ✔ |
   | Respaldo completo | ✔ | ✔ | ✔ |
   | Historia clínica | ✖ | ✔ | ✔ |

2. DALU cambia el plan de cada empresa en la columna **Plan** de *Negocios · DALU*. Si la empresa usa más de lo que permite el plan nuevo, se avisa; no se borra nada, pero no puede agregar más hasta quedar dentro del límite.
3. Solo DALU puede cambiar el plan, la dirección corta o pausar una empresa (lo hace cumplir la base).
4. La base no deja pasar de los límites: «Tu plan permite N sede(s)…» / «Tu plan permite N usuarios…».
5. Al llegar al límite, Usuarios y Sedes muestran «Llegaste al máximo de … de tu plan. Con <plan siguiente> tienes hasta N.» con **«Quiero mejorar mi plan»** (WhatsApp de DALU).
6. Un módulo que no está en el plan no aparece en el menú; si se entra por la dirección: «no está incluida en tu plan».
7. Una empresa **pausada** no ve ningún dato: «Tu empresa está pausada».

### Sedes
8. Clientes, mascotas e historial son de **toda la empresa**: una mascota puede ir a cualquier sede.
9. La **agenda** y los **precios** son de **cada sede**. Una sede nueva arranca con los precios de la primera.
10. El administrador ve todas las sedes y las administra en **Sedes** (agregar, cambiar el nombre, pausar/activar). Debe quedar al menos una sede activa.
11. Cada colaborador ve solo sus sedes (Usuarios → Sedes → Cambiar, o al invitarlo). Sin sede asignada ve «Aún no tienes sede asignada».
12. Arriba se elige la sede en la que se trabaja (se recuerda en ese navegador).
13. Hoy, Agendar y Agenda trabajan con la sede elegida; la ficha de la mascota muestra en qué sede la atendieron; Reportes tiene filtro por sede.
14. Las sedes de una empresa solo las ve esa empresa (ni siquiera DALU ve sus nombres; solo cuántas usa).
15. Mientras una empresa tenga una sola sede, si se cambian precios en la versión anterior del panel (tabla `razas`), pasan solos a los precios de su sede.

### Videos
16. El módulo Videos está **oculto** (no se borró): no aparece en el menú ni en la entrada, y su dirección lleva a Hoy.

### Base de datos
17. `sql-v13-planes-y-sedes.sql` (tablas `planes`, `sedes`, `usuarios_sedes`, `precios_sede`; `sede_id` en citas y servicios; vista `razas_sede`; funciones `mis_sedes()`, `uso_negocios()`), `sql-v15-sedes-solo-mi-empresa.sql` y `sql-v16-suscripcion-marketing.sql` (Básico → Esencial).

## Escenarios

```gherkin
# language: es
Característica: Sedes y planes

  Escenario: DALU cambia el plan de una empresa
    Dado que estoy en "Negocios · DALU"
    Cuando cambio el plan de "Vet Norte" a "Profesional" y confirmo
    Entonces veo "Vet Norte quedó en el plan Profesional"

  Escenario: El plan Esencial no deja agregar otra sede
    Dado que soy administradora de una empresa en plan Esencial
    Cuando abro "Sedes"
    Entonces "Agregar sede" está deshabilitado
    Y veo "Con Profesional tienes hasta 2." y "Quiero mejorar mi plan"

  Escenario: Límite de usuarios
    Dado que mi plan Esencial ya tiene 3 usuarios entre cuentas e invitaciones
    Cuando abro "Usuarios"
    Entonces "Invitar" está deshabilitado
    Y veo "Con Profesional tienes hasta 8."

  Escenario: Cada sede con sus precios
    Dado que mi empresa tiene "Sede principal" y "Sede Norte"
    Cuando en Catálogos elijo "Sede Norte" y cambio el baño de "Cocker" a 50000
    Entonces al agendar en "Sede Norte" el precio sugerido es 50000
    Y en "Sede principal" sigue el precio anterior

  Escenario: Una mascota va a otra sede
    Dado que "Luna" siempre va a "Sede principal"
    Cuando la agendo en "Sede Norte"
    Entonces la cita queda en la agenda de "Sede Norte"
    Y su historial muestra las dos sedes

  Escenario: El colaborador solo ve su sede
    Dado que soy colaborador asignado a "Sede Norte"
    Entonces no puedo elegir "Sede principal" ni ver su agenda

  Escenario: Empresa pausada
    Dado que DALU pausó mi empresa
    Cuando inicio sesión
    Entonces veo "Tu empresa está pausada" y ningún dato
```
