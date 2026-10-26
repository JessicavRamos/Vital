# 10 · Multinegocio (una sola base para todos los clientes de DALU Vital)

## Qué cambia
- Cada dato (clientes, mascotas, citas, servicios, razas, guías…) pertenece a un **negocio**.
- La base (RLS) solo deja ver y cambiar los datos del negocio de quien inició sesión.
  No depende del código del sitio: aunque alguien manipule la página, la base no le entrega datos de otro negocio.
- Todo lo que existía quedó en **Pet Garden** (negocio 1).
- **DALU** (pantalla *Negocios · DALU*) crea negocios y sus invitaciones, pero **no ve** los datos de los clientes.

## Usuarios nuevos (solo con invitación)
1. El administrador del negocio va a **Usuarios → Invitar a alguien** (correo + rol).
2. Al invitar aparece el mensaje para enviarlo por **WhatsApp** o **correo** (o copiarlo).
   En *Invitaciones pendientes*, **Reenviar** lo vuelve a abrir.
   La persona entra con el enlace y toca **«¿Te invitaron? Crea tu cuenta»** con ese correo.
3. Confirma el correo que le llega y entra: queda en ese negocio con el rol elegido.

Sin invitación no se puede crear cuenta (tampoco desde Supabase → Authentication → Add user:
primero invita el correo y luego crea el usuario).

## Negocio nuevo (DALU)
*Negocios · DALU → Crear un negocio*: nombre, dirección corta y correo del administrador.
La base le copia los servicios y recordatorios base y deja lista la invitación del administrador.
Su enlace es `https://vital.dalu.pro/direccion-corta` (GitHub muestra `404.html`, que lleva a la página con ese negocio).

## Pagos de la suscripción
- **DALU** registra cada pago en *Negocios · DALU → Pagos de la suscripción*: negocio, fecha, valor,
  **próximo pago** y nota opcional. El próximo pago se sugiere solo: un mes después del anterior
  (mantiene el día, ej. el 4 de cada mes); en el primer pago de una empresa eliges tú el día.
  El valor se sugiere con el precio del plan de esa empresa.
- El **precio mensual de cada plan** se edita en la tarjeta *Planes*. Si cambias el plan de una empresa
  o el precio de un plan, su próximo pago muestra el valor nuevo.
- La lista de negocios muestra el próximo pago de cada uno: **Al día**, **Vence en N días** (5 días antes)
  o **Pago pendiente**.
- **El administrador de cada negocio** ve en **Suscripción**: su plan, el estado, la fecha del último pago,
  la del próximo y, pequeño, el valor del próximo pago. **No** ve valores pagados ni sumas
  (la base ya no le deja leer la tabla de pagos). Los colaboradores no ven esta sección.

## Enlaces por negocio
- Entrada: `vital.dalu.pro/petgarden` muestra el nombre y el logo de ese negocio antes de iniciar sesión.
- Los enlaces viejos con `?negocio=petgarden` siguen funcionando.
- Con sesión abierta, el enlace de OTRO negocio no muestra sus datos (la base no lo permite):
  aparece un aviso para seguir en el propio negocio o cerrar sesión.
- Sin negocio en la dirección se usa el último negocio abierto en ese navegador o `NEGOCIO_POR_DEFECTO` (config.js).
- Cada administrador ve sus enlaces en **Catálogos → Logo del negocio**.

## Archivos
El logo y los archivos nuevos se guardan en la carpeta del negocio (`logo/1/…`, `videos/2/…`).
Los archivos que Pet Garden subió antes (sin carpeta) siguen funcionando.

## Planes (los asigna DALU)
| | Básico | Profesional | Premium |
|---|---|---|---|
| Sedes activas | 1 | 2 | 5 |
| Usuarios (cuentas + invitaciones pendientes) | 3 | 8 | 20 |
| Recordatorios (A quién buscar) | ✔ | ✔ | ✔ |
| Reportes y Excel | ✔ | ✔ | ✔ |
| Respaldo completo | ✔ | ✔ | ✔ |
| Historia clínica | ✖ | ✔ | ✔ |

- DALU cambia el plan de cada empresa en *Negocios · DALU* (columna Plan) y edita los límites en la tarjeta **Planes**.
- Solo DALU puede cambiar plan, dirección corta o pausar una empresa (lo hace cumplir la base).
- La base no deja pasar de los límites: al agregar una sede o invitar a alguien de más aparece
  «Tu plan permite N…, cambia de plan con DALU».
- Una empresa **pausada** no ve ningún dato hasta que DALU la active.
- El administrador ve su plan y su uso en **Suscripción**.

## Sedes
- Clientes, mascotas e historial son de **toda la empresa**: una mascota puede ir a cualquier sede.
- La **agenda** y los **precios** son de **cada sede** (Catálogos → Razas y precios, eligiendo la sede).
  Una sede nueva arranca con los precios de la primera.
- El administrador ve todas las sedes. Cada colaborador ve solo las sedes que le asignen
  (Usuarios → Sedes → Cambiar, o al invitarlo). Arriba aparece el selector de sede.
- Reportes tiene filtro por sede. El historial de cada mascota muestra en qué sede la atendieron.

- Mientras una empresa tenga una sola sede, si se cambian precios en la versión anterior del panel
  (tabla razas), pasan solos a los precios de su sede (v15).

## Videos
Ocultos (no se borraron): no aparecen en el menú ni en enlaces. Los datos siguen en la base.

## Base de datos
Ejecutar en orden `sql-v11-multinegocio.sql` (necesita el v10), `sql-v12-cerrar-funciones.sql`, `sql-v13-planes-y-sedes.sql`, `sql-v14-suscripcion.sql` y `sql-v15-sedes-solo-mi-empresa.sql`. Va en una transacción: si algo falla, no cambia nada.
Probado contra una réplica de la base: 51 comprobaciones de aislamiento entre negocios (incluidos los pagos), 45 de sedes y planes, 17 de la suscripción y 10 de los ajustes del v15.

## Correos (confirmación de cuenta y "olvidé mi contraseña")
Sin un servidor de correo propio (SMTP), Supabase solo envía correos a los miembros del equipo del proyecto.
Para que les lleguen a todos, configura un SMTP (por ejemplo Brevo) en Supabase → Authentication → Emails → SMTP Settings.
