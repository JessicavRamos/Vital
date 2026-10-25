"use strict";

/* =====================================================================
   USUARIOS (solo administrador): quién usa el sistema y con qué rol.
   - Administrador: todo, incluidos Reportes y Usuarios, y borrar videos.
   - Empleado ("Colaborador"): el día a día (agendar, terminar, cancelar, guías, videos sin borrar).
     Precios, servicios, recordatorios y logo los ve pero no los cambia.
   Los usuarios nuevos se crean en Supabase (Authentication → Users) y aparecen
   aquí solos como "empleado".
   ===================================================================== */

// En la base el rol se guarda como "empleado"; en pantalla se muestra "Colaborador".
const ROLES = { administrador: "Administrador", empleado: "Colaborador" };

async function cargarUsuarios() {
  const caja = $("#u-lista");
  if (!caja) return;
  try {
    const usuarios = await q(db.from("perfiles").select("id,correo,nombre,rol,creado_en").order("rol").order("correo"));
    if (!$("#u-lista")) return;
    const yo = estado.sesion && estado.sesion.user.id;
    tablaInteractiva(caja, {
      id: "usuarios",
      filas: usuarios,
      vacio: "Todavía no hay usuarios.",
      columnas: [
        { titulo: "Nombre", valor: (u) => u.nombre ?? "", filtro: "texto" },
        { titulo: "Correo", valor: (u) => u.correo ?? "", filtro: "texto" },
        { titulo: "Rol", valor: (u) => ROLES[u.rol] ?? u.rol, filtro: "lista" },
        { titulo: "Desde", valor: (u) => u.creado_en ?? "", filtro: false },
      ],
      fila: (u) => `<tr${u.id === yo ? ' class="activa"' : ""}>
        <td>${esc(u.nombre || "—")}${u.id === yo ? ' <span class="etiqueta">tú</span>' : ""}</td>
        <td>${esc(u.correo || "—")}</td>
        <td><select data-rol="${esc(u.id)}" aria-label="Rol de ${esc(u.nombre || u.correo || "usuario")}">
          ${Object.entries(ROLES).map(([clave, texto]) => `<option value="${clave}"${clave === u.rol ? " selected" : ""}>${texto}</option>`).join("")}
        </select></td>
        <td>${esc(u.creado_en ? fechaCorta(diaDe(u.creado_en)) : "—")}</td>
      </tr>`,
      alPintar: (tbody) => $$("[data-rol]", tbody).forEach((sel) => sel.addEventListener("change", () =>
        cambiarRol(usuarios.find((u) => u.id === sel.dataset.rol), sel))),
    });
  } catch (error) {
    mostrarError(caja, error);
  }
}

async function cambiarRol(usuario, select) {
  const nuevo = select.value;
  const anterior = usuario.rol;
  const quien = usuario.nombre || usuario.correo;
  const soyYo = estado.sesion && usuario.id === estado.sesion.user.id;
  const [titulo, texto] = nuevo === "administrador"
    ? [`¿Dar rol de administrador a ${quien}?`, "Podrá ver Reportes, administrar usuarios, cambiar precios y catálogos, y borrar videos."]
    : soyYo
      ? ["¿Quitarte a ti misma el rol de administrador?", "Dejarás de ver Reportes y Usuarios."]
      : [`¿Cambiar a ${quien} a colaborador?`, "Dejará de ver Reportes y Usuarios y no podrá cambiar precios ni catálogos."];
  if (!(await confirmar({ titulo, texto, boton: "Sí, cambiar" }))) { select.value = anterior; return; }
  try {
    const filas = await q(db.from("perfiles").update({ rol: nuevo }).eq("id", usuario.id).select("id"));
    if (!filas.length) throw new Error("permission denied");
    usuario.rol = nuevo;
    aviso(`${quien} ahora es ${ROLES[nuevo].toLowerCase()}.`);
    if (soyYo) { await cargarRol(); pintar(); return; }
    cargarUsuarios();
  } catch (error) {
    select.value = anterior;
    aviso(mensajeError(error), true);
  }
}

PANTALLAS.usuarios = {
  html: () => `<h1>Usuarios</h1>
    <p class="suave">Quién usa el sistema y qué puede hacer. Solo el administrador ve esta pantalla.</p>
    ${estado.sinRoles ? '<p class="aviso-fijo">Los roles aún no están activos: falta ejecutar en Supabase el SQL de roles (v8). Mientras tanto, todos tienen acceso completo.</p>' : ""}
    <div class="columnas derecha">
      <div class="tarjeta"><div id="u-lista"><p class="suave">Cargando…</p></div></div>
      <div class="tarjeta">
        <h2>Qué puede hacer cada rol</h2>
        <table class="tabla-permisos">
          <thead><tr><th></th><th>Admin.</th><th>Colaborador</th></tr></thead>
          <tbody>
            <tr><td>Hoy, Agendar, Agenda, Clientes</td><td>✔</td><td>✔</td></tr>
            <tr><td>Ver precios</td><td>✔</td><td>✔</td></tr>
            <tr><td>Cancelar citas y servicios</td><td>✔</td><td>✔</td></tr>
            <tr><td>Guías</td><td>✔</td><td>✔</td></tr>
            <tr><td>Precios por raza, servicios, recordatorios y logo</td><td>✔</td><td>Solo ver</td></tr>
            <tr><td>Subir, editar y activar videos</td><td>✔</td><td>✔</td></tr>
            <tr><td>Borrar videos</td><td>✔</td><td>✖</td></tr>
            <tr><td>Reportes y Excel</td><td>✔</td><td>✖</td></tr>
            <tr><td>Usuarios y roles</td><td>✔</td><td>✖</td></tr>
          </tbody>
        </table>
        <h2>Agregar un usuario</h2>
        <ol class="pasos">
          <li>Entra a Supabase → <strong>Authentication → Users</strong>.</li>
          <li>Presiona <strong>Add user</strong> (o <em>Invite user</em>), escribe su correo y una contraseña.</li>
          <li>Vuelve aquí: aparece solo como <strong>Colaborador</strong>. Si debe ser administrador, cámbialo en la lista.</li>
        </ol>
        <p class="suave">Para quitarle el acceso a alguien, elimínalo en Supabase → Authentication → Users.
        Su historial (citas, servicios, cancelaciones) se conserva.</p>
      </div>
    </div>`,
  despues: cargarUsuarios,
};
