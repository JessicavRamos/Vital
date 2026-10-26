# Feature 12 · Parametrización: dónde se cambia cada cosa

Guía de **todo lo que se puede ajustar** en DALU Vital y **dónde** se hace.
Ordenada de lo más fácil (desde la app, sin tocar código) a lo más técnico.

| Nivel | Dónde | Quién | ¿Hay que subir a git? |
|---|---|---|---|
| A | Panel **Negocios · DALU** (en la app) | DALU | No |
| B | Pantallas del **administrador** de cada empresa (en la app) | Administrador | No |
| C | **Cada usuario** (en la app) | Cualquiera | No |
| D | Archivo **`config.js`** | DALU | Sí |
| E | **Código** (constantes y textos en los `.js` y `estilos.css`) | DALU | Sí, y subir la versión en `index.html` |
| F | **Base de datos** (Supabase → SQL Editor) | DALU | No |
| G | **Panel de Supabase** (correo, inicio de sesión, archivos) | DALU | No |
| H | **GitHub y dominio** | DALU | — |

> **Regla de oro para D y E:** después de cambiar un archivo `.js` o `.css`, cambia el número `?v=` de **todas** las líneas de `index.html`
> (ej. `?v=2026102602` → `?v=2026102701`) y sube con `git add .`, `git commit -m "..."` y `git push`.
> Así los navegadores no se quedan con la versión vieja y la página abierta muestra «Hay una versión nueva».

---

## A. Panel «Negocios · DALU» (solo DALU)

| Qué | Dónde exactamente | Notas |
|---|---|---|
| **Crear una empresa** | Negocios · DALU → desplegar *Crear una empresa*: nombre, dirección corta, correo del administrador, plan | La dirección corta define el enlace `vital.dalu.pro/<direccion>`. Solo minúsculas, números y guiones. La empresa nueva copia los **servicios y recordatorios de Pet Garden** (ver F3) y queda con «Sede principal» |
| **Plan de cada empresa** | Lista de empresas → **Ver ficha** → *Plan y uso* → Plan | Se puede cambiar cuando quieras. Pide confirmación y avisa si la empresa usa más de lo que permite el plan nuevo |
| **Pausar / activar una empresa** | **Ver ficha** → **Pausar** / **Activar** (arriba a la derecha) | Pausada: sus usuarios no ven ningún dato («Tu empresa está pausada»). No se borra nada |
| **Invitar a alguien a cualquier empresa** | **Ver ficha** → *Usuarios* → «Invitar a alguien a <empresa>»: correo y rol | Útil para crear el primer administrador o ayudar a un cliente |
| **Nombre de cada plan** | Sección desplegable **Planes** → fila *Nombre* | Ej. «Esencial». Lo ven los clientes en Suscripción y en el comparador |
| **Precio mensual de cada plan** | Sección desplegable **Planes** → fila *Precio mensual* | Mientras esté en 0 no se muestra el valor en Suscripción ni la fila de precios del comparador. Se sugiere al registrar un pago |
| **Sedes por plan** | Sección desplegable **Planes** → fila *Sedes* | La base no deja pasar el límite |
| **Usuarios por plan** | Sección desplegable **Planes** → fila *Usuarios* | Cuentan las cuentas **y** las invitaciones pendientes |
| **Módulos de cada plan** | Sección desplegable **Planes** → casillas *Recordatorios*, *Reportes y Excel*, *Respaldo completo*, *Historia clínica* | Un módulo apagado desaparece del menú de esas empresas |
| **Registrar un pago** | **Ver ficha** de la empresa → *Pagos de <empresa>*: fecha, valor, **próximo pago**, nota | El **día de pago** de cada empresa se fija en su **primer** pago con el campo *Próximo pago* (ej. el 4). Los siguientes se sugieren solos un mes después |
| **Cambiar el día de pago** de una empresa | Registra su siguiente pago con el *Próximo pago* en el día nuevo | Desde ahí se sugiere ese día cada mes |
| **Corregir un pago** | **Ver ficha** → *Pagos* → **Quitar** y volver a registrarlo | |
| **Ver todos los pagos** | Sección desplegable **Todos los pagos** (total recibido y del mes) | |

**Lo que hoy NO tiene pantalla** (se hace en F): cambiar el **nombre** o la **dirección corta** de una empresa, crear un **cuarto plan**, nombrar a otra persona como DALU.

---

## B. Administrador de cada empresa (en la app)

| Qué | Dónde exactamente | Notas |
|---|---|---|
| **Precios por raza** | Catálogos → *Razas y precios* (elige la sede arriba si hay varias) | Columnas Baño, Corte, Corte y baño, Uñas. **Cada sede tiene sus precios**. Se guarda al cambiar la celda |
| **Razas** (agregar, renombrar, quitar) | Catálogos → *Razas y precios* | El nombre es de toda la empresa; una raza nueva queda en todas las sedes. Quitarla deja a sus mascotas sin raza |
| **Guías** (de la máquina) | Catálogos → *Guías* | Los colaboradores también pueden editarlas |
| **Servicios** y a qué recordatorio pertenecen | Catálogos → *Servicios y recordatorios* | Ej. «Spa» → grupo «Spa» |
| **Cada cuántos días buscar a un cliente** | Catálogos → *Servicios y recordatorios* → columna *Días* del grupo | Define «A quién buscar hoy». Ej. Spa = 30 días |
| **Logo** | Catálogos → *Logo del negocio* | PNG, JPG, WebP o SVG de hasta 2 MB. Sale en la entrada, en el menú y en la pestaña |
| **Enlace para compartir** | Catálogos → *Logo del negocio* → «Enlace de <empresa>» | El enlace corto de la empresa (solo se muestra; lo cambia DALU, ver F2) |
| **Sedes** (agregar, renombrar, pausar) | **Sedes** | Una sede nueva arranca con los precios de la primera. Limitado por el plan |
| **Usuarios**: invitar, rol, sedes | **Usuarios** → *Invitar a alguien* / columna Rol / Sedes → *Cambiar* | El colaborador solo ve sus sedes. Debe quedar al menos un administrador |
| **Reenviar o quitar una invitación** | Usuarios → *Invitaciones pendientes* | |
| **Descartar a alguien de «A quién buscar»** | Hoy → ✕ en la persona | Solo por este ciclo; vuelve en el siguiente |

---

## C. Cada usuario (en la app)

| Qué | Dónde | Notas |
|---|---|---|
| Su **nombre** | Abajo del menú → toca 👤 su nombre (o «Escribe tu nombre») | Sale en cancelaciones y en los mensajes a DALU |
| Su **contraseña** | Entrada → «¿Olvidaste tu contraseña?» | Mínimo 6 caracteres. Necesita el correo configurado (G2) |
| **Sede** en la que trabaja | Selector 📍 arriba | Se recuerda en ese navegador |
| Orden y filtros de las tablas | Encabezados de cada tabla | Se recuerdan mientras la página esté abierta |
| Tablas abiertas en Reportes | Reportes → cada tabla se despliega | |
| Cerrar el aviso de renovación | Hoy → ✕ | Para esa renovación (si está pendiente, vuelve al otro día) |

---

## D. Archivo `config.js`

| Constante | Valor actual | Para qué |
|---|---|---|
| `SUPABASE_URL` | `https://hkzaxvijtomwhzmvyqkq.supabase.co` | Dirección de la base. Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | clave pública | Clave pública (no secreta). Nunca pongas aquí la clave `service_role` |
| `NEGOCIO_POR_DEFECTO` | `"petgarden"` | Empresa que se muestra si alguien entra a `vital.dalu.pro` sin dirección corta |
| `NOMBRE_NEGOCIO` | `"Pet Garden"` | Solo para bases antiguas sin multinegocio (hoy no se usa) |
| `DALU_WHATSAPP` | `"3223050787"` | WhatsApp de DALU: «Quiero mejorar mi plan», «Ya pagué», «Quiero <plan>». Se escribe sin espacios; el 57 se agrega solo |
| `DALU_MEDIOS_PAGO` | Nequi y Daviplata `311 212 1501` | Lista de medios de pago en Suscripción → Cómo pagar. Formato: `{ nombre: "Bancolombia ahorros", numero: "123-456789-01" }`. Se pueden agregar o quitar líneas |

---

## E. En el código (constantes y textos)

### E1. Producto y fechas
| Archivo | Constante / lugar | Valor | Para qué |
|---|---|---|---|
| `app.js` | `NOMBRE_PRODUCTO` | `"DALU Vital"` | Nombre del producto en la pestaña, firma y mensajes |
| `app.js` | `ZONA` | `"America/Bogota"` | Zona horaria de todas las fechas |
| `app.js` | `opcionesHora()` | 7:00 a. m. a 8:00 p. m. cada 30 min | Horas para elegir al agendar |
| `app.js` | `MOTIVOS_RAPIDOS` | El cliente canceló, no llegó, error al registrar, precio o servicio equivocado | Botones rápidos al cancelar |
| `app.js` | botones `data-valor="8000"` y `"16000"` | +$8.000 / +$16.000 | Recargos rápidos del baño medicado |
| `app.js` | `COLUMNA_PRECIO` | Baño, Corte, Corte y baño, Uñas | Servicios que tienen precio por raza (deben llamarse igual en Catálogos) |
| `app.js` | `SERVICIOS_CON_BANO` | Baño, Corte y baño | Los únicos que pueden ser medicados |
| `agendar.js` | `HIST_INICIAL` | 5 | Visitas que se ven primero en el historial al agendar |
| `app.js` | `setInterval(revisarVersionNueva, 5 * 60 * 1000)` | 5 minutos | Cada cuánto revisa si hay versión nueva |

### E2. Suscripción y renovación
| Archivo | Constante / lugar | Valor | Para qué |
|---|---|---|---|
| `app.js` | `DIAS_GRACIA` | 5 | Días antes de renovar en que sale «Se renueva en N días», y días de gracia de «Renovación pendiente» antes de «Renovación vencida» (rojo) |
| `app.js` | `aviso: dias <= 3` (en `estadoPago`) | 3 | Desde cuántos días antes sale el aviso en Hoy |
| `suscripcion.js` | `DIAS_GRACIAS_PAGO` | 10 | Días después de un pago en que se muestra «✔ Recibimos tu pago» |
| `suscripcion.js` | `BENEFICIOS_PLAN` | textos de cada módulo | Cómo se describe cada módulo en «Lo que incluye tu plan» y en el comparador |
| `negocios.js` | `MODULOS_PLAN` | textos | Nombres de los módulos en tu tarjeta Planes |
| `usuarios.js` | `ROLES` | Administrador / Colaborador | Nombre que se muestra de cada rol |

### E3. Mensajes de WhatsApp (textos)
| Mensaje | Archivo y función | Cuándo sale |
|---|---|---|
| Recordatorio «A quién buscar» | `hoy.js` (botón WhatsApp de cada pendiente) | Clientes que ya deben volver |
| Recordatorio de cita | `app.js` → `mensajeRecordatorioCita` | Botón «Recordar» |
| Ya puede recoger | `app.js` → `mensajeRecoger` | Botón «Avisar» |
| Invitación | `app.js` → `mensajeInvitacion` | Al invitar a alguien |
| Mejorar plan | `app.js` → `mensajeMejorarPlan` | Botones «Quiero mejorar mi plan» / «Quiero <plan>» |
| Ya pagué | `app.js` → `mensajeYaPague` | «Ya pagué, avisar a DALU» |

Los mensajes usan solo el primer nombre del dueño y el nombre de la empresa que viene de la base.

### E4. Reportes, archivos y respaldo
| Archivo | Constante | Valor | Para qué |
|---|---|---|---|
| `reportes.js` | `RANGOS` | Este mes, Mes pasado, Últimos 3 meses, Este año, Todo | Botones de período |
| `reportes.js` | `FORMATO_DINERO` / `FORMATO_FECHA` | `"$"#,##0` / `dd/mm/yyyy` | Formato en el Excel |
| `reportes.js` | `TABLAS_RESPALDO` | lista de tablas | Qué entra en el respaldo completo |
| `catalogos.js` | `2 * 1024 * 1024` y `TIPOS_LOGO` | 2 MB; PNG, JPG, WebP, SVG | Límite y tipos del logo |
| `videos.js` | `MAX_VIDEO`, `TIPOS_VIDEO` | 50 MB; MP4, WebM | Solo si se vuelve a mostrar Videos |
| `app.js` | `MENU` | lista de secciones | Orden y nombres del menú. Videos está oculto aquí |

### E5. Apariencia
| Qué | Dónde |
|---|---|
| **Colores** (tema claro) | `estilos.css`, línea 1: `:root{--fondo…; --marca:#0F5C6B; --sol:#F6C945; --ok…; --alerta…}` |
| **Colores** (tema oscuro) | `estilos.css`, línea 2: `@media (prefers-color-scheme:dark){…}` |
| **Tipografías** | `index.html` (Google Fonts **Fredoka** y **Nunito**) y `estilos.css` |
| **Versión de los archivos** | `index.html`: el `?v=` de cada `<script>` y del CSS |

---

## F. Base de datos (Supabase → SQL Editor)

| # | Qué | Cómo |
|---|---|---|
| F1 | **Nombre de una empresa** | `update public.negocios set nombre = 'Nuevo nombre' where slug = 'petgarden';` |
| F2 | **Dirección corta** de una empresa | `update public.negocios set slug = 'nueva-direccion' where id = 1;` (el enlace viejo deja de funcionar) |
| F3 | **Plantilla de una empresa nueva** | `crear_negocio` copia los **grupos de recordatorio** y los **servicios** de la empresa 1 (Pet Garden). Lo que cambies en Catálogos de Pet Garden es lo que reciben las empresas nuevas. También crea «Sede principal» y deja el plan Esencial si no se elige otro |
| F4 | **Quién es DALU** (ve el panel Negocios · DALU) | `insert into public.dalu_admins (usuario_id) select id from auth.users where email = 'correo@dalu.pro';` |
| F5 | **Agregar un cuarto plan** | `insert into public.planes (id, nombre, orden, precio_mensual, max_sedes, max_usuarios, recordatorios, reportes, respaldo, historia_clinica) values ('empresarial', 'Empresarial', 4, 0, 10, 50, true, true, true, true);` Después se edita en el panel |
| F6 | Ver el **uso** de cada empresa | En la app: lista y ficha. Las funciones `uso_negocios()` y `usuarios_de_negocio(id)` (v17) solo responden a DALU |
| F8 | **Borrar una empresa de prueba** con todo lo suyo (y las cuentas de sus correos) | `sql-borrar-demo-y-kiros.sql`: cambia los `slug` de la línea `where slug in (...)` y el número esperado. Nunca deja borrar Pet Garden. No se puede deshacer |
| F7 | **Zona horaria** de los cálculos de la base | Funciones `resumen_mes` y otras usan `'America/Bogota'` |

---

## G. Panel de Supabase (supabase.com → tu proyecto)

| # | Qué | Dónde |
|---|---|---|
| G1 | **Dirección del sitio** para los correos | Authentication → URL Configuration → *Site URL* = `https://vital.dalu.pro` y *Redirect URLs* = `https://vital.dalu.pro/**` |
| G2 | **Correo propio (SMTP)** para que lleguen confirmaciones y «olvidé mi contraseña» | Authentication → Emails → SMTP Settings (ej. Brevo `smtp-relay.brevo.com`, puerto 587). Sin esto solo les llega a los miembros del equipo de Supabase |
| G3 | **Texto de los correos** (confirmar cuenta, recuperar contraseña) | Authentication → Emails → Templates |
| G4 | **Permitir crear cuentas** | Authentication → Sign In / Providers → *Allow new users to sign up* (activo; igual solo entra quien tiene invitación) |
| G5 | **Largo mínimo de contraseña** | Authentication → Sign In / Providers → Email → *Minimum password length* (la app pide 6) |
| G6 | **Tamaño máximo de archivos** | Storage → buckets `logo` y `videos` → *File size limit* |
| G7 | **Claves** | Project Settings → API (la pública va en `config.js`) |

---

## H. GitHub y dominio

| Qué | Dónde |
|---|---|
| **Rama publicada** | GitHub → repositorio *Vital* → Settings → Pages → *Branch* (hoy `main`). Las pruebas van en otra rama (ej. `sedes-y-planes`) y se unen a `main` para publicar |
| **Dominio** | Archivo `CNAME` (`vital.dalu.pro`) y Settings → Pages → *Custom domain* + *Enforce HTTPS* |
| **DNS** | Namecheap → dalu.pro → Advanced DNS: registro `CNAME vital → jessicavramos.github.io` |
| **Enlaces cortos** (`/petgarden`) | Archivo `404.html` (no se cambia) |

---

## Lista rápida: dejar lista una empresa nueva

1. **Negocios · DALU → Crear un negocio**: nombre, dirección corta, correo del administrador y plan.
2. Envíale la invitación por WhatsApp (se abre sola al crearla).
3. Registra su **primer pago** con el *Próximo pago* en su día de cobro.
4. Su administrador entra y ajusta: **Catálogos** (precios, razas, guías, servicios y días de recordatorio, logo), **Sedes** y **Usuarios**.
