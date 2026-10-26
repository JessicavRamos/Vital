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
    // Sedes de cada persona (el administrador maneja todas las sedes)
    let asignaciones = [];
    if (estado.conSedes) {
      try { asignaciones = await q(db.from("usuarios_sedes").select("usuario_id,sede_id")); } catch (error) { /* sin sedes */ }
    }
    usuarios.forEach((u) => { u.sedes = asignaciones.filter((a) => a.usuario_id === u.id).map((a) => a.sede_id); });
    if (!$("#u-lista")) return;
    pintarUsoUsuarios(usuarios.length);
    const yo = estado.sesion && estado.sesion.user.id;
    const textoSedes = (u) => (u.rol === "administrador" ? "Todas"
      : u.sedes.map(nombreSede).filter(Boolean).join(", ") || "Sin sede");
    tablaInteractiva(caja, {
      id: "usuarios",
      filas: usuarios,
      vacio: "Todavía no hay usuarios.",
      columnas: [
        { titulo: "Nombre", valor: (u) => u.nombre ?? "", filtro: "texto" },
        { titulo: "Correo", valor: (u) => u.correo ?? "", filtro: "texto" },
        { titulo: "Rol", valor: (u) => ROLES[u.rol] ?? u.rol, filtro: "lista" },
        ...(estado.conSedes ? [{ titulo: "Sedes", valor: textoSedes, filtro: "texto" }] : []),
        { titulo: "Desde", valor: (u) => u.creado_en ?? "", filtro: false },
      ],
      fila: (u) => `<tr${u.id === yo ? ' class="activa"' : ""}>
        <td>${esc(u.nombre || "—")}${u.id === yo ? ' <span class="etiqueta">tú</span>' : ""}</td>
        <td>${esc(u.correo || "—")}</td>
        <td><select data-rol="${esc(u.id)}" aria-label="Rol de ${esc(u.nombre || u.correo || "usuario")}">
          ${Object.entries(ROLES).map(([clave, texto]) => `<option value="${clave}"${clave === u.rol ? " selected" : ""}>${texto}</option>`).join("")}
        </select></td>
        ${estado.conSedes ? `<td>${esc(textoSedes(u))}${u.rol !== "administrador" && estado.sedes.length > 1
          ? ` <button type="button" class="btn alt chico" data-sedes="${esc(u.id)}">Cambiar</button>` : ""}</td>` : ""}
        <td>${esc(u.creado_en ? fechaCorta(diaDe(u.creado_en)) : "—")}</td>
      </tr>`,
      alPintar: (tbody) => {
        $$("[data-rol]", tbody).forEach((sel) => sel.addEventListener("change", () =>
          cambiarRol(usuarios.find((u) => u.id === sel.dataset.rol), sel)));
        $$("[data-sedes]", tbody).forEach((b) => b.addEventListener("click", () =>
          editarSedesUsuario(usuarios.find((u) => u.id === b.dataset.sedes))));
      },
    });
  } catch (error) {
    mostrarError(caja, error);
  }
  cargarInvitaciones();
}

// "3 de 8 usuarios (plan Profesional)" — cuentan las cuentas y las invitaciones pendientes.
let usoCuentas = 0, usoInvitaciones = 0;
function pintarUsoUsuarios(cuentas, invitaciones) {
  if (cuentas !== undefined) usoCuentas = cuentas;
  if (invitaciones !== undefined) usoInvitaciones = invitaciones;
  const caja = $("#u-uso");
  if (!caja || !estado.plan) return;
  const total = usoCuentas + usoInvitaciones, max = estado.plan.max_usuarios;
  caja.innerHTML = `Usuarios: <strong>${total} de ${max}</strong> (plan ${esc(estado.plan.nombre)}; cuentan las invitaciones pendientes).`;
  const lleno = total >= max;
  const boton = $("#form-invitar button[type=submit]");
  if (boton) boton.disabled = lleno;
  const alerta = $("#u-lleno");
  if (alerta) {
    alerta.hidden = !lleno;
    if (lleno && !alerta.dataset.pintado) { alerta.dataset.pintado = "1"; pintarAvisoLimite(alerta, "max_usuarios", "usuarios"); }
  }
}

// Casillas de sedes (para invitar o cambiar las sedes de alguien)
const htmlCasillasSedes = (prefijo, marcadas) => estado.sedes.filter((x) => x.activo).map((x) =>
  `<label class="casilla"><input type="checkbox" name="${prefijo}-sede" value="${x.id}"${marcadas.includes(x.id) ? " checked" : ""}> ${esc(x.nombre)}</label>`).join("");
const sedesMarcadas = (raiz, prefijo) => $$(`input[name="${prefijo}-sede"]:checked`, raiz).map((c) => Number(c.value));

function editarSedesUsuario(usuario) {
  if (!usuario) return;
  const dialogo = abrirDialogo(`<form id="form-sedes-usuario">
    <h2>Sedes de ${esc(usuario.nombre || usuario.correo)}</h2>
    <p class="suave">Solo verá y manejará la agenda de las sedes marcadas. El historial de las mascotas lo ve completo.</p>
    <div class="casillas">${htmlCasillasSedes("eu", usuario.sedes)}</div>
    <p id="eu-error" class="error" role="alert"></p>
    <div class="acciones">
      <button type="button" class="btn alt" id="eu-volver">Volver</button>
      <button type="submit" class="btn">Guardar</button>
    </div></form>`);
  $("#eu-volver").addEventListener("click", () => cerrarDialogo());
  $("#form-sedes-usuario").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const nuevas = sedesMarcadas(dialogo, "eu");
    if (!nuevas.length) { $("#eu-error").textContent = "Marca al menos una sede."; return; }
    const quitar = usuario.sedes.filter((id) => !nuevas.includes(id));
    const agregar = nuevas.filter((id) => !usuario.sedes.includes(id));
    try {
      if (agregar.length) await q(db.from("usuarios_sedes").insert(agregar.map((sede_id) => ({ usuario_id: usuario.id, sede_id }))));
      if (quitar.length) await q(db.from("usuarios_sedes").delete().eq("usuario_id", usuario.id).in("sede_id", quitar));
      cerrarDialogo();
      aviso(`Sedes de ${usuario.nombre || usuario.correo} actualizadas.`);
      cargarUsuarios();
    } catch (error) {
      $("#eu-error").textContent = mensajeError(error);
    }
  });
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
    pintarUsoUsuarios(undefined, filas.length);
    caja.innerHTML = filas.length
      ? `<ul class="lista-invitaciones">${filas.map((i) => `<li>
          <span><strong>${esc(i.correo)}</strong> · ${esc(ROLES[i.rol] || i.rol)}</span>
          <span class="acciones-invitacion">
            <button type="button" class="btn alt chico" data-reenviar="${esc(i.correo)}">Reenviar</button>
            <button type="button" class="btn alt chico" data-quitar="${esc(i.correo)}">Quitar</button></span></li>`).join("")}</ul>`
      : '<p class="suave">No hay invitaciones pendientes.</p>';
    $$("[data-quitar]", caja).forEach((b) => b.addEventListener("click", () => quitarInvitacion(b.dataset.quitar)));
    $$("[data-reenviar]", caja).forEach((b) => b.addEventListener("click", () =>
      abrirEnvioInvitacion(b.dataset.reenviar, estado.negocio, "Reenviar la invitación")));
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
    const datos = { p_correo: correo, p_rol: $("#i-rol").value };
    if (estado.conSedes && $("#i-sedes")) {
      const sedes = sedesMarcadas($("#i-sedes"), "i");
      if (datos.p_rol === "empleado" && !sedes.length) { error.textContent = "Marca al menos una sede."; boton.disabled = false; return; }
      if (sedes.length) datos.p_sedes = sedes;
    }
    const resultado = await q(db.rpc("invitar_usuario", datos));
    evento.target.reset();
    if (resultado === "asignado") aviso(`${correo} ya tenía cuenta: quedó agregado a ${nombreNegocio()}.`);
    else abrirEnvioInvitacion(correo, estado.negocio, "Invitación lista: envíasela");
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

function verPermisosRoles() {
  abrirDialogo(`<div>
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
        <tr><td>Suscripción (pagos a DALU)</td><td>✔</td><td>✖</td></tr>
      </tbody>
    </table>
    <div class="acciones"><button type="button" class="btn" id="roles-cerrar">Cerrar</button></div></div>`);
  $("#roles-cerrar").addEventListener("click", () => cerrarDialogo());
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
          ${estado.conSedes && estado.sedes.filter((x) => x.activo).length > 1 ? `<fieldset id="i-sedes" class="casillas"><legend>Sedes</legend>
            ${htmlCasillasSedes("i", estado.sede ? [estado.sede.id] : [])}</fieldset>` : ""}
          <p id="i-error" class="error" role="alert"></p>
          <p id="u-uso" class="suave"></p>
          <p id="u-lleno" class="aviso-fijo" hidden>Llegaste al máximo de usuarios de tu plan. Para agregar más, cambia de plan con DALU.</p>
          <h3>Invitaciones pendientes</h3>
          <div id="u-invitaciones"><p class="suave">Cargando…</p></div>
        </div>
      </div>
      <div class="tarjeta">
        <h2>Roles</h2>
        <p class="suave"><strong>Administrador:</strong> todo. <strong>Colaborador:</strong> el día a día, sin Reportes, Usuarios ni cambios de precios.</p>
        <p><button type="button" class="btn alt chico" id="ver-roles">Ver qué puede hacer cada rol</button></p>
        <h2>Agregar un usuario</h2>
        <ol class="pasos">
          <li>Escribe su correo en <strong>Invitar a alguien</strong> y elige el rol.</li>
          <li>Envíale el mensaje por WhatsApp o correo (aparece al invitar; con <strong>Reenviar</strong> lo vuelves a mandar).</li>
          <li>La persona entra con tu enlace, toca <strong>«¿Te invitaron? Crea tu cuenta»</strong> y aparece aquí con el rol que elegiste.</li>
        </ol>
        <p class="suave">Solo se pueden crear cuentas con invitación. Para quitarle el acceso a alguien,
        escríbele a DALU. Su historial (citas, servicios, cancelaciones) se conserva.</p>
      </div>
    </div>`,
  despues: () => {
    const formulario = $("#form-invitar");
    if (formulario) formulario.addEventListener("submit", invitarUsuario);
    $("#ver-roles").addEventListener("click", verPermisosRoles);
    return cargarUsuarios();
  },
};
