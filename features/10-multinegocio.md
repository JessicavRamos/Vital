# Feature 10 · Multinegocio (DALU Vital)

Desde la v14 el sistema se llama **DALU Vital** y una sola base de datos sirve a varios negocios
(veterinarias, pet shops, spas). **Pet Garden** es el negocio 1.
Los planes y las sedes de cada negocio están en [11-sedes-y-planes.md](11-sedes-y-planes.md).

## Historias de usuario

**Como** DALU (dueña del producto)
**quiero** crear negocios, invitar a su administrador y registrar sus pagos
**para** venderle el sistema a varios clientes sin ver los datos de ninguno.

**Como** administradora de un negocio
**quiero** invitar a mi equipo por correo y ver mi plan, cuándo se renueva y lo que logré este mes
**para** que solo entre quien yo autorice y tener claro el valor que me da el sistema.

## Reglas de negocio

### Aislamiento entre negocios
1. Cada dato (clientes, mascotas, citas, servicios, razas, guías, videos…) pertenece a un **negocio** (`negocio_id`). La base lo llena sola al guardar.
2. La base (RLS) solo deja ver y cambiar los datos del negocio de quien inició sesión. No depende del código del sitio: aunque alguien manipule la página, la base no le entrega datos de otro negocio.
3. Un dato no puede apuntar a un dato de otro negocio ("Ese dato pertenece a otro negocio").
4. Lo que antes era único en toda la base ahora es único dentro de cada negocio (dos negocios pueden tener un cliente con el mismo teléfono o una raza "Criollo").
5. Todo lo que existía quedó en **Pet Garden** (negocio 1).
6. **DALU** (pantalla *Negocios · DALU*) crea negocios e invitaciones, pero **no ve** los datos de los clientes.
7. Siempre debe quedar al menos un administrador **en cada negocio**.

### Marca
8. La pestaña del navegador dice **"<Negocio> · DALU Vital"** (o solo "DALU Vital" si no hay negocio).
9. La entrada muestra el nombre y el logo del negocio y abajo **"Con tecnología de DALU Vital"**; el menú lateral termina con "DALU Vital".
10. Los mensajes de WhatsApp, el Excel y el respaldo usan el nombre del negocio que viene de la base (ya no `NOMBRE_NEGOCIO`).

### Usuarios nuevos (solo con invitación)
11. El administrador va a **Usuarios → Invitar a alguien** (correo + rol). Al invitar aparece el mensaje para enviarlo por **WhatsApp**, **correo** o **copiarlo**. En *Invitaciones pendientes* están **Reenviar** y **Quitar**.
12. La persona entra con el enlace del negocio y toca **«¿Te invitaron? Crea tu cuenta»** (nombre, correo, contraseña de mínimo 6). Confirma el correo y queda en ese negocio con el rol elegido.
13. Sin invitación no se puede crear cuenta, ni desde el sitio ni desde Supabase → Authentication → Add user (primero se invita el correo).
14. Si el correo invitado **ya tenía cuenta**, queda agregado al negocio de una vez: "<correo> ya tenía cuenta: quedó agregado a <negocio>."
15. Un usuario sin negocio ve "Tu usuario aún no tiene negocio" y solo puede cerrar sesión.

### Enlaces por negocio
16. Cada negocio tiene una **dirección corta** (`slug`): solo minúsculas, números y guiones. Su enlace es `https://vital.dalu.pro/<slug>` (ej. `vital.dalu.pro/petgarden`).
17. GitHub Pages no conoce `/petgarden`: muestra `404.html`, que abre la página con `?negocio=petgarden`, y el sitio vuelve a dejar la dirección como `/petgarden` (sin recargar).
18. Los enlaces viejos con `?negocio=petgarden` siguen funcionando y se cambian por la dirección corta.
19. Sin negocio en la dirección se usa el último negocio abierto en ese navegador o `NEGOCIO_POR_DEFECTO` (config.js).
20. Con sesión abierta, el enlace de **otro** negocio no muestra sus datos: aparece "Este enlace es de <otro>" con **Seguir en <mi negocio>** o **Cerrar sesión**.
21. Cada administrador ve su enlace en **Catálogos → Logo del negocio**.

### Archivos
22. El logo y los videos nuevos se guardan en la carpeta del negocio (`logo/1/…`, `videos/2/…`). Los archivos que Pet Garden subió antes (sin carpeta) siguen funcionando.

### Pagos de la suscripción
23. **Panel Negocios · DALU** (v17):
    - **Resumen:** empresas activas, ingreso mensual esperado (suma del precio del plan de las activas), renovaciones pendientes y lo recibido este mes.
    - **Lista de empresas:** nombre y enlace, plan y precio, renovación con su estado, uso (usuarios y sedes frente al plan), actividad (servicios del mes y último ingreso) y estado.
    - **Ver ficha** (o tocar el nombre): plan (se cambia ahí), uso y módulos; renovación (estado, próximo y último pago, valor, total pagado); actividad **solo en conteos** (clientes, mascotas, citas y servicios del mes, último servicio, último ingreso); usuarios con su **último ingreso**; invitaciones pendientes (Reenviar); invitar a alguien a esa empresa; **Pausar/Activar**; e **histórico de pagos** de esa empresa con *Registrar pago* y *Quitar*.
    - Secciones desplegables: *Crear una empresa*, *Planes* y *Todos los pagos* (con total recibido y del mes).
    En la ficha se registra cada pago: fecha, valor, **próximo pago** (renovación) y nota opcional. El próximo pago se sugiere un mes después del anterior (mantiene el día, ej. el 4 de cada mes); en el primer pago de una empresa se elige el día. El valor se sugiere con el precio del plan. DALU ve el **histórico completo** y puede quitar un pago registrado por error. La lista de negocios muestra la renovación de cada uno con su estado.
24. **El administrador** de cada negocio ve en **Suscripción** (los colaboradores no la ven):
    - Su plan, **«Cliente desde <mes>»** y el estado de la renovación (estilo DALU: sobrio y cercano, sin emojis).
    - **«Tu plan se renueva el <fecha>»** y, pequeño, el valor actual de su plan.
    - Hasta 10 días después de un pago: **«✔ Recibimos tu pago del <fecha>.»**
    - **«Tu <mes> con DALU Vital»**: citas agendadas, servicios realizados, mascotas atendidas, mascotas que regresaron y cuántas llegaron por primera vez. Si el mes no tiene movimiento: «Tu mes apenas empieza…».
    - **Cómo pagar:** medios de pago de DALU (`DALU_MEDIOS_PAGO` en `config.js`: Nequi y Daviplata) con «Copiar número», y **«Ya pagué, avisar a DALU»** / «Enviar comprobante por WhatsApp» (`DALU_WHATSAPP`).
    - **Lo que incluye tu plan**: todos los módulos, con ✔ lo que tiene y ✖ lo que no.
    - **Haz crecer tu negocio**: comparador con su plan marcado y solo los planes de arriba (nunca los más baratos), con «Quiero <plan>» por WhatsApp. En el plan más alto no aparece.
    - **No ve valores pagados ni sumas:** la base ya no le deja leer la tabla `pagos`; solo recibe `mi_suscripcion()`.
25. **Estados de la renovación** (amables): *Al día* (verde) → *Se renueva en N días* (amarillo, 5 días antes) → *Se renueva hoy* → *Renovación pendiente* (amarillo, hasta 5 días de gracia) → *Renovación vencida* (rojo).
26. **Aviso en Hoy** (solo administrador): desde 3 días antes de la renovación, o si quedó pendiente: «🔔 Tu plan <plan> se renueva el <fecha>» con «Ver cómo pagar» y ✕ para cerrarlo (si está pendiente, vuelve a salir al otro día).

### Correos (confirmación de cuenta y "olvidé mi contraseña")
27. Sin un servidor de correo propio (SMTP), Supabase solo envía correos a los miembros del equipo del proyecto. Para que les lleguen a todos hay que configurar un SMTP (por ejemplo Brevo) en Supabase → Authentication → Emails → SMTP Settings.
28. El sistema **no envía** las invitaciones: el administrador comparte el mensaje por WhatsApp o correo.

### Base de datos
29. Ejecutar en orden `sql-v11-multinegocio.sql` (necesita el v10), `sql-v12-cerrar-funciones.sql` (ninguna función se puede llamar sin sesión), `sql-v13-planes-y-sedes.sql`, `sql-v14-suscripcion.sql`, `sql-v15-sedes-solo-mi-empresa.sql`, `sql-v16-suscripcion-marketing.sql` y `sql-v17-panel-dalu.sql`. Para borrar empresas de prueba: `sql-borrar-demo-y-kiros.sql` (modelo para borrar otras: cambia los `slug`). Cada uno va en una transacción: si algo falla, no cambia nada.
30. Probado contra una réplica de la base: 51 comprobaciones de aislamiento entre negocios, 45 de sedes y planes, 17 de la suscripción, 10 del v15, 8 del v16 y 8 del v17.

### Mensajes de error nuevos

| Error técnico | Mensaje mostrado |
|---|---|
| sin invitación / `database error saving new user` | Ese correo no tiene invitación. Pide al administrador de tu negocio que te invite y vuelve a intentar. |
| `user already registered` | Ese correo ya tiene cuenta. Inicia sesión o usa «¿Olvidaste tu contraseña?». |
| `negocios_slug_key` | Ya existe un negocio con esa dirección corta. Usa otra. |

## Escenarios

```gherkin
# language: es
Característica: Multinegocio

  # ---------- Aislamiento ----------
  Escenario: Cada negocio ve solo sus datos
    Dado que inicié sesión como administradora de Pet Garden
    Cuando abro "Clientes y mascotas", "Agenda" o "Usuarios"
    Entonces solo veo datos y personas de Pet Garden

  Escenario: DALU no ve las personas de otros negocios en Usuarios
    Dado que inicié sesión como DALU y administradora de Pet Garden
    Cuando abro "Usuarios"
    Entonces solo veo las personas de Pet Garden

  Escenario: La base protege los datos aunque se manipule la página
    Dado que soy usuaria de Pet Garden
    Cuando intento leer citas de otro negocio directamente en la base con mi sesión
    Entonces la base no devuelve ninguna fila

  # ---------- Entrada y enlaces ----------
  Escenario: Sin sesión, la entrada muestra el negocio de la dirección
    Dado que no he iniciado sesión
    Cuando abro "vital.dalu.pro/vet-norte"
    Entonces veo el nombre y el logo de "Vet Norte"
    Y abajo dice "Con tecnología de DALU Vital"

  Escenario: Enlace viejo con ?negocio=
    Cuando abro "vital.dalu.pro/?negocio=petgarden"
    Entonces veo la entrada de Pet Garden
    Y la barra de direcciones queda "vital.dalu.pro/petgarden"

  Escenario: Enlace de otro negocio con la sesión abierta
    Dado que inicié sesión con una cuenta de Pet Garden
    Cuando abro "vital.dalu.pro/vet-norte"
    Entonces veo "Este enlace es de Vet Norte"
    Y no veo ningún dato de Vet Norte
    Cuando presiono "Seguir en Pet Garden"
    Entonces sigo en mi panel y la dirección vuelve a "/petgarden"

  Escenario: Usuario sin negocio
    Dado que inicié sesión con un usuario que no está en ningún negocio
    Entonces veo "Tu usuario aún no tiene negocio"
    Y no veo el panel

  # ---------- Invitaciones ----------
  Escenario: El administrador invita a alguien
    Dado que soy administradora y estoy en "Usuarios"
    Cuando escribo "andres@correo.com", elijo "Colaborador" y presiono "Invitar"
    Entonces se abre "Invitación lista: envíasela" con el mensaje y el enlace del negocio
    Y veo los botones "Enviar por WhatsApp", "Enviar por correo" y "Copiar mensaje"
    Y "andres@correo.com" aparece en "Invitaciones pendientes"

  Escenario: Reenviar una invitación
    Dado que "andres@correo.com" está en "Invitaciones pendientes"
    Cuando presiono "Reenviar"
    Entonces se abre otra vez el mensaje para enviarlo

  Escenario: Crear la cuenta con invitación
    Dado que me invitaron con "andres@correo.com"
    Cuando toco "¿Te invitaron? Crea tu cuenta", escribo mi nombre, ese correo y una contraseña
    Entonces veo "¡Listo! Revisa tu correo y confirma la cuenta para poder entrar."
    Y al confirmar e iniciar sesión quedo en ese negocio con el rol de la invitación

  Escenario: Crear cuenta sin invitación
    Cuando intento crear una cuenta con un correo que nadie invitó
    Entonces veo "Ese correo no tiene invitación. Pide al administrador de tu negocio que te invite y vuelve a intentar."

  # ---------- DALU ----------
  Escenario: Solo DALU ve "Negocios · DALU"
    Dado que inicié sesión como administradora que no es de DALU
    Entonces el menú no tiene "Negocios · DALU"
    Y si abro "#/negocios" vuelvo a Hoy con "Esa sección es solo para DALU."

  Escenario: DALU crea un negocio
    Dado que inicié sesión como DALU y estoy en "Negocios · DALU"
    Cuando escribo el nombre "Vet Norte", la dirección "vet-norte", el correo del administrador y el plan
    Y presiono "Crear negocio"
    Entonces veo "¡Vet Norte quedó creado! Envíale la invitación a su administrador"
    Y el negocio aparece en la lista con su enlace "/vet-norte"
    Y la base le copió los servicios y recordatorios base

  Escenario: Dirección corta repetida
    Cuando creo un negocio con una dirección que ya existe
    Entonces veo "Ya existe un negocio con esa dirección corta. Usa otra."

  # ---------- Archivos ----------
  Escenario: El logo se guarda en la carpeta del negocio
    Dado que soy administradora del negocio 2
    Cuando subo un logo en Catálogos
    Entonces el archivo queda en "logo/2/"

  # ---------- Pagos ----------
  Escenario: DALU registra un pago y la renovación se sugiere sola
    Dado que estoy en "Negocios · DALU → Pagos de la suscripción"
    Y el pago anterior de "Vet Norte" quedó con renovación el 4 de noviembre
    Cuando elijo "Vet Norte"
    Entonces "Próximo pago" muestra el 4 de diciembre y "Valor" el precio de su plan
    Cuando presiono "Registrar pago"
    Entonces veo "Pago registrado para Vet Norte. Próximo pago: 04/12/2026."

  Escenario: DALU revisa una empresa en su ficha
    Dado que estoy en "Negocios · DALU"
    Cuando toco "Ver ficha" de "Pet Garden"
    Entonces veo su plan, uso, renovación, actividad en conteos, usuarios con su último ingreso
    Y el histórico de pagos solo de Pet Garden, con el total pagado

  Escenario: El administrador ve el valor y no el gasto
    Dado que soy administradora de Pet Garden en plan Premium
    Cuando abro "Suscripción"
    Entonces veo "Premium", "Cliente desde octubre de 2026" y "Tu plan se renueva el …"
    Y veo cuántas citas, servicios y mascotas atendí este mes
    Y no veo valores pagados antes ni el total pagado

  Escenario: Gracias después de pagar
    Dado que DALU registró mi pago hace 2 días
    Cuando abro "Suscripción"
    Entonces veo "✔ Recibimos tu pago del … ¡Gracias por seguir con nosotros!"

  Escenario: Renovación pendiente amable
    Dado que mi renovación era hace 3 días
    Entonces veo "Renovación pendiente" en amarillo y "Si ya pagaste, avísanos y la registramos."
    Pero si pasan más de 5 días veo "Renovación vencida" en rojo

  Escenario: Avisar que ya pagué
    Cuando presiono "Ya pagué, avisar a DALU"
    Entonces se abre WhatsApp con DALU y el mensaje "… Ya pagué la renovación de DALU Vital. Te envío el comprobante."

  Escenario: Mejorar el plan
    Dado que estoy en plan Esencial
    Cuando abro "Suscripción"
    Entonces el comparador marca "Esencial · Tu plan" y ofrece "Quiero Profesional" y "Quiero Premium"
    Y no muestra planes más baratos que el mío

  Escenario: Aviso de renovación en Hoy
    Dado que soy administradora y mi plan se renueva en 2 días
    Cuando abro "Hoy"
    Entonces veo "🔔 Tu plan Premium se renueva el …" con "Ver cómo pagar"
    Cuando lo cierro con ✕
    Entonces no vuelve a salir para esa renovación

  Escenario: El colaborador no ve Suscripción
    Dado que inicié sesión como colaborador
    Entonces el menú no tiene "Suscripción"
```
