# 10 · Multinegocio (una sola base para todos los clientes de DALU Vital)

## Qué cambia
- Cada dato (clientes, mascotas, citas, servicios, razas, guías, videos…) pertenece a un **negocio**.
- La base (RLS) solo deja ver y cambiar los datos del negocio de quien inició sesión.
  No depende del código del sitio: aunque alguien manipule la página, la base no le entrega datos de otro negocio.
- Todo lo que existía quedó en **Pet Garden** (negocio 1).
- **DALU** (pantalla *Negocios · DALU*) crea negocios y sus invitaciones, pero **no ve** los datos de los clientes.

## Usuarios nuevos (solo con invitación)
1. El administrador del negocio va a **Usuarios → Invitar a alguien** (correo + rol).
2. La persona entra a la página y toca **«¿Te invitaron? Crea tu cuenta»** con ese correo.
3. Confirma el correo que le llega y entra: queda en ese negocio con el rol elegido.

Sin invitación no se puede crear cuenta (tampoco desde Supabase → Authentication → Add user:
primero invita el correo y luego crea el usuario).

## Negocio nuevo (DALU)
*Negocios · DALU → Crear un negocio*: nombre, dirección corta y correo del administrador.
La base le copia los servicios y recordatorios base y deja lista la invitación del administrador.
Su enlace es `https://vital.dalu.pro/?negocio=direccion-corta`.

## Pagos de la suscripción (solo informativo)
- **DALU** registra cada pago en *Negocios · DALU → Pagos de la suscripción*: negocio, fecha, valor y nota opcional.
  También puede quitar un pago registrado por error.
- **El administrador de cada negocio** lo ve en el menú **Suscripción**: último pago, su valor,
  total pagado y el historial. No puede registrar, cambiar ni borrar pagos. Los colaboradores no ven esta sección.

## Enlaces por negocio
- Entrada: `?negocio=petgarden` muestra el nombre y el logo de ese negocio antes de iniciar sesión.
- Videos públicos: `?negocio=petgarden#/videos` muestra solo los videos de ese negocio.
- Sin `?negocio=` se usa el último negocio abierto en ese navegador o `NEGOCIO_POR_DEFECTO` (config.js).
- Cada administrador ve sus enlaces en **Catálogos → Logo del negocio**.

## Archivos
Logo y videos nuevos se guardan en la carpeta del negocio (`logo/1/…`, `videos/2/…`).
Los archivos que Pet Garden subió antes (sin carpeta) siguen funcionando.

## Base de datos
Ejecutar `sql-v11-multinegocio.sql` (necesita el v10). Va en una transacción: si algo falla, no cambia nada.
Probado contra una réplica de la base: 51 comprobaciones de aislamiento entre negocios (incluidos los pagos).
