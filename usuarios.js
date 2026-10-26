"use strict";

/* =====================================================================
   USUARIOS (solo administrador): quién usa el sistema en ESTE negocio y con qué rol.
   - Administrador: todo, incluidos Reportes y Usuarios, y borrar videos.
   - Empleado ("Colaborador"): el día a día (agendar, terminar, cancelar, guías, videos sin borrar).
     Precios, servicios, recordatorios y logo los ve pero no los cambia.
   Usuarios nuevos: el administrador los invita por correo aquí; la persona entra a la
   página, toca "¿Te invitaron? Crea tu cuenta" y queda en este negocio con ese rol.
   ===================================================================== */

// En la base el rol se guarda como "empleado"; en pantalla se muestra "Colaborador".
const ROLES = { administrador: "Administrador", empleado: "Colaborador" };

async function cargarUsuarios() {
  const caja = $("#u-lista");
  if (!caja) return;
  try {
    let consulta = db.from("perfiles").select("id,correo,nombre,rol,creado_en").order("rol").order("correo");
    // DALU puede ver perfiles de todos los negocios: aquí solo se muestran los de este.
    if (estado.negocio && estado.negocio.id) consulta = consulta.eq("negocio_id", estado.negocio.id);
    const usuarios = await q(consulta);
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
  cargarInvitaciones();
}

// Invitaciones que todavía no se han usado (la persona aún no crea su cuenta).
async function cargarInvitaciones() {
  const caja = $("#u-invitaciones");
  if (!caja || estado.sinRoles) return;
  try {
    let consulta = db.from("invitaciones").select("correo,rol,creado_en").order("creado_en", { ascending: false });
    if (estado.negocio && estado.negocio.id) consulta = consulta.eq("negocio_id", estado.negocio.id);
    const filas = await q(consulta);
    if (!$("#u-invitaciones")) return;
    caja.innerHTML = filas.length
      ? `<ul class="lista-invitaciones">${filas.map((i) => `<li>
          <span><strong>${esc(i.correo)}</strong> · ${esc(ROLES[i.rol] || i.rol)}</span>
          <button type="button" class="btn alt chico" data-quitar="${esc(i.correo)}">Quitar</button></li>`).join("")}</ul>`
      : '<p class="suave">No hay invitaciones pendientes.</p>';
    $$("[data-quitar]", caja).forEach((b) => b.addEventListener("click", () => quitarInvitacion(b.dataset.quitar)));
  } catch (error) {
    // Base sin el SQL v11: todavía no hay invitaciones.
    caja.innerHTML = `<p class="suave">${esc(mensajeError(error))}</p>`;
  }
}

async function invitarUsuario(evento) {
  evento.preventDefault();
  const error = $("#i-error");
  const boton = $("button[type=submit]", evento.target);
  error.textContent = "";
  boton.disabled = true;
  try {
    const correo = $("#i-correo").value.trim().toLowerCase();
    const resultado = await q(db.rpc("invitar_usuario", { p_correo: correo, p_rol: $("#i-rol").value }));
    evento.target.reset();
    aviso(resultado === "asignado"
      ? `${correo} ya tenía cuenta: quedó agregado a ${nombreNegocio()}.`
      : `Invitación lista. Dile a ${correo} que entre y toque «¿Te invitaron? Crea tu cuenta».`);
    cargarUsuarios();
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
  } finally {
    boton.disabled = false;
  }
}

async function quitarInvitacion(correo) {
  if (!(await confirmar({ titulo: `¿Quitar la invitación de ${correo}?`, texto: "Ya no podrá crear su cuenta con ese correo.", boton: "Sí, quitar" }))) return;
  try {
    await q(db.from("invitaciones").delete().eq("correo", correo));
    aviso("Invitación quitada.");
    cargarInvitaciones();
  } catch (error) {
    aviso(mensajeError(error), true);
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
    <p class="suave">Quién usa el sistema en ${esc(nombreNegocio())} y qué puede hacer. Solo el administrador ve esta pantalla.</p>
    ${estado.sinRoles ? '<p class="aviso-fijo">Los roles aún no están activos: falta ejecutar en Supabase el SQL de roles (v8). Mientras tanto, todos tienen acceso completo.</p>' : ""}
    <div class="columnas derecha">
      <div>
        <div class="tarjeta"><div id="u-lista"><p class="suave">Cargando…</p></div></div>
        <div class="tarjeta">
          <h2>Invitar a alguien</h2>
          <form id="form-invitar" class="fila-form">
            <div><label for="i-correo">Correo</label>
              <input id="i-correo" type="email" autocomplete="off" required></div>
            <div><label for="i-rol">Rol</label>
              <select id="i-rol">${Object.entries(ROLES).map(([clave, texto]) => `<option value="${clave}"${clave === "empleado" ? " selected" : ""}>${texto}</option>`).join("")}</select></div>
            <button class="btn" type="submit">Invitar</button>
          </form>
          <p id="i-error" class="error" role="alert"></p>
          <h3>Invitaciones pendientes</h3>
          <div id="u-invitaciones"><p class="suave">Cargando…</p></div>
        </div>
      </div>
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
            <tr><td>Usuarios, roles e invitaciones</td><td>✔</td><td>✖</td></tr>
          </tbody>
        </table>
        <h2>Agregar un usuario</h2>
        <ol class="pasos">
          <li>Escribe su correo en <strong>Invitar a alguien</strong> y elige el rol.</li>
          <li>Dile que entre a la página y toque <strong>«¿Te invitaron? Crea tu cuenta»</strong> con ese mismo correo.</li>
          <li>Confirma el correo que le llega y listo: aparece aquí con el rol que elegiste.</li>
        </ol>
        <p class="suave">Solo se pueden crear cuentas con invitación. Para quitarle el acceso a alguien,
        escríbele a DALU. Su historial (citas, servicios, cancelaciones) se conserva.</p>
      </div>
    </div>`,
  despues: () => {
    const formulario = $("#form-invitar");
    if (formulario) formulario.addEventListener("submit", invitarUsuario);
    return cargarUsuarios();
  },
};
