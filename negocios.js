"use strict";

/* =====================================================================
   NEGOCIOS (solo DALU): las empresas que usan DALU Vital.
   - Resumen: empresas activas, ingreso mensual esperado, renovaciones pendientes
     y lo recibido este mes.
   - Lista de empresas; "Ver ficha" abre todo lo de una empresa: plan y uso,
     renovación, actividad (solo conteos), usuarios con su último ingreso,
     invitaciones, invitar, pausar/activar e histórico de pagos (registrar y quitar).
   - Secciones desplegables: crear una empresa, planes (nombre, precio, límites,
     módulos) y todos los pagos.
   DALU administra las empresas pero NO ve los datos de sus clientes.
   El administrador de cada empresa NO ve los pagos: en "Suscripción" solo ve
   la fecha del último pago, la de renovación y el valor actual de su plan.
   ===================================================================== */

// "Veterinaria San Roque" → "veterinaria-san-roque"
function slugDe(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

let NEG = [], PLANES = [], USO = new Map(), PAGOS = [], INVITACIONES = [];
let FICHA_ID = null; // empresa abierta en la ficha
// Último pago registrado de un negocio (PAGOS viene ordenado del más reciente al más viejo)
const ultimoPagoDe = (negocioId) => PAGOS.find((p) => p.negocio_id === negocioId);
const pagosDe = (negocioId) => PAGOS.filter((p) => p.negocio_id === negocioId);
const planDe = (n) => PLANES.find((p) => p.id === n.plan_id);
const nombreNegocioDe = (id) => (NEG.find((n) => n.id === id) || {}).nombre || `Empresa ${id}`;
const MODULOS_PLAN = { recordatorios: "Recordatorios", reportes: "Reportes y Excel", respaldo: "Respaldo completo", historia_clinica: "Historia clínica" };

// "hoy", "ayer", "hace 5 días", "nunca"
function haceCuanto(fechaHora) {
  if (!fechaHora) return "nunca";
  const dia = new Date(fechaHora).toLocaleDateString("en-CA", { timeZone: ZONA });
  const dias = -diasHasta(dia);
  return dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
}

async function cargarNegocios() {
  const caja = $("#n-lista");
  if (!caja) return;
  try {
    try {
      [NEG, PLANES] = await Promise.all([
        q(db.from("negocios").select("id,nombre,slug,activo,creado_en,plan_id").order("id")),
        q(db.from("planes").select("*").order("orden")),
      ]);
      USO = new Map((await q(db.rpc("uso_negocios"))).map((u) => [u.negocio_id, u]));
    } catch (error) {
      // Base sin planes (antes del SQL v13)
      NEG = await q(db.from("negocios").select("id,nombre,slug,activo,creado_en").order("id"));
      PLANES = []; USO = new Map();
    }
    try {
      PAGOS = await q(db.from("pagos").select("id,negocio_id,fecha,valor,nota,proximo_pago")
        .order("fecha", { ascending: false }).order("id", { ascending: false }));
    } catch (error) {
      PAGOS = []; // Base sin el SQL v14 (sin "próximo pago")
    }
    try {
      INVITACIONES = await q(db.from("invitaciones").select("correo,rol,negocio_id,creado_en").order("creado_en", { ascending: false }));
    } catch (error) {
      INVITACIONES = [];
    }
    if (!$("#n-lista")) return;
    pintarResumenDalu();
    pintarListaNegocios();
    pintarPlanes();
    pintarTodosLosPagos();
    const selectorPlan = $("#nn-plan");
    if (selectorPlan && PLANES.length && !selectorPlan.options.length) {
      selectorPlan.innerHTML = PLANES.map((p) => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join("");
    }
    if (FICHA_ID && NEG.some((n) => n.id === FICHA_ID)) pintarFichaNegocio(FICHA_ID);
    else cerrarFichaNegocio();
  } catch (error) {
    mostrarError(caja, error);
  }
}

/* ---------- Resumen ---------- */
function pintarResumenDalu() {
  const caja = $("#n-resumen");
  if (!caja) return;
  const activas = NEG.filter((n) => n.activo);
  const esperado = activas.reduce((suma, n) => suma + Number((planDe(n) || {}).precio_mensual || 0), 0);
  const pendientes = activas.filter((n) => { const u = ultimoPagoDe(n.id); return u && diasHasta(u.proximo_pago) < 0; }).length;
  const mes = hoyISO().slice(0, 8) + "01";
  const recibido = PAGOS.filter((p) => p.fecha >= mes).reduce((suma, p) => suma + Number(p.valor || 0), 0);
  caja.innerHTML = `
    <div class="stat"><b>${activas.length}</b>Empresas activas${NEG.length > activas.length ? ` <span class="suave">(${NEG.length - activas.length} pausada${NEG.length - activas.length === 1 ? "" : "s"})</span>` : ""}</div>
    <div class="stat"><b>${esc(dinero(esperado))}</b>Ingreso mensual esperado</div>
    <div class="stat"><b class="${pendientes ? "texto-alerta" : ""}">${pendientes}</b>Renovaciones pendientes</div>
    <div class="stat"><b>${esc(dinero(recibido))}</b>Recibido este mes</div>`;
}

/* ---------- Lista de empresas ---------- */
function htmlProximoPago(negocio) {
  const ultimo = ultimoPagoDe(negocio.id);
  const est = estadoPago(ultimo && ultimo.proximo_pago);
  return `<span class="fila-proximo">${ultimo ? `<span>${esc(fechaCorta(ultimo.proximo_pago))}</span>` : ""}
    <span class="etiqueta ${est.clase}">${esc(est.texto)}</span></span>`;
}

function pintarListaNegocios() {
  const caja = $("#n-lista");
  const textoUso = (n) => {
    const u = USO.get(n.id), p = planDe(n);
    if (!u || !p) return "";
    const usuarios = u.usuarios + u.invitaciones;
    const excede = u.sedes > p.max_sedes || usuarios > p.max_usuarios;
    return `<span class="uso-negocio ${excede ? "mal" : ""}">${usuarios}/${p.max_usuarios} usuarios<br><span class="suave">${u.sedes}/${p.max_sedes} sedes</span></span>`;
  };
  const textoActividad = (n) => {
    const u = USO.get(n.id);
    if (!u || u.servicios_mes === undefined) return "";
    return `<span class="uso-negocio">${u.servicios_mes} servicios este mes<br><span class="suave">Último ingreso: ${esc(haceCuanto(u.ultimo_ingreso))}</span></span>`;
  };
  tablaInteractiva(caja, {
    id: "negocios",
    filas: NEG,
    vacio: "Todavía no hay empresas.",
    columnas: [
      { titulo: "Empresa", valor: (n) => n.nombre, filtro: "texto" },
      ...(PLANES.length ? [{ titulo: "Plan", valor: (n) => (planDe(n) || {}).nombre || "", filtro: "lista" }] : []),
      { titulo: "Renovación", valor: (n) => (ultimoPagoDe(n.id) || {}).proximo_pago || "9999", filtro: false },
      ...(PLANES.length ? [{ titulo: "Uso", valor: (n) => { const u = USO.get(n.id); return u ? u.usuarios + u.invitaciones : 0; }, filtro: false }] : []),
      { titulo: "Actividad", valor: (n) => { const u = USO.get(n.id); return u ? Number(u.servicios_mes || 0) : 0; }, filtro: false },
      { titulo: "Estado", valor: (n) => (n.activo ? "Activa" : "Pausada"), filtro: "lista" },
      { titulo: "", valor: () => "", filtro: false },
    ],
    fila: (n) => {
      const p = planDe(n);
      return `<tr class="${n.id === FICHA_ID ? "fila-elegida" : ""}">
        <td><button type="button" class="enlace nombre-empresa" data-ficha-negocio="${n.id}">${esc(n.nombre)}</button>
          ${estado.negocio && n.id === estado.negocio.id ? ' <span class="etiqueta">la tuya</span>' : ""}
          <br><a class="suave enlace-chico" href="${esc(enlacePublico(n.slug))}" target="_blank" rel="noopener">/${esc(n.slug)}</a></td>
        ${PLANES.length ? `<td>${p ? `${esc(p.nombre)}${Number(p.precio_mensual) > 0 ? `<br><span class="suave">${esc(dinero(p.precio_mensual))}/mes</span>` : ""}` : "—"}</td>` : ""}
        <td>${htmlProximoPago(n)}</td>
        ${PLANES.length ? `<td>${textoUso(n)}</td>` : ""}
        <td>${textoActividad(n)}</td>
        <td>${n.activo ? '<span class="etiqueta ok">Activa</span>' : '<span class="etiqueta gris">Pausada</span>'}</td>
        <td><button type="button" class="btn chico" data-ficha-negocio="${n.id}">Ver ficha</button></td>
      </tr>`;
    },
    alPintar: (tbody) => $$("[data-ficha-negocio]", tbody).forEach((b) =>
      b.addEventListener("click", () => abrirFichaNegocio(Number(b.dataset.fichaNegocio)))),
  });
}

/* ---------- Ficha de una empresa ---------- */
function abrirFichaNegocio(id) {
  FICHA_ID = id;
  pintarFichaNegocio(id);
  pintarListaNegocios();
  const ficha = $("#n-ficha");
  if (ficha && ficha.scrollIntoView) ficha.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cerrarFichaNegocio() {
  FICHA_ID = null;
  const ficha = $("#n-ficha");
  if (ficha) { ficha.hidden = true; ficha.innerHTML = ""; }
}

async function pintarFichaNegocio(id) {
  const ficha = $("#n-ficha");
  const n = NEG.find((x) => x.id === id);
  if (!ficha || !n) return;
  const p = planDe(n), u = USO.get(n.id) || {}, pagos = pagosDe(n.id), ultimo = pagos[0];
  const est = estadoPago(ultimo && ultimo.proximo_pago);
  const invitaciones = INVITACIONES.filter((i) => i.negocio_id === n.id);
  const totalPagado = pagos.reduce((suma, x) => suma + Number(x.valor || 0), 0);
  const conActividad = u.servicios_mes !== undefined;
  const dato = (titulo, valor) => `<div><span>${titulo}</span><b>${valor}</b></div>`;

  ficha.hidden = false;
  ficha.innerHTML = `
    <div class="ficha-cabeza">
      <div>
        <p class="sus-etiqueta">Ficha de la empresa</p>
        <h2 class="ficha-nombre">${esc(n.nombre)} ${n.activo ? '<span class="etiqueta ok">Activa</span>' : '<span class="etiqueta gris">Pausada</span>'}</h2>
        <p class="suave"><a href="${esc(enlacePublico(n.slug))}" target="_blank" rel="noopener">${esc(enlacePublico(n.slug))}</a>
          · Cliente desde ${esc(fechaCorta(String(n.creado_en).slice(0, 10)))}</p>
      </div>
      <div class="acciones-tabla">
        <button type="button" class="btn alt chico" id="f-activo">${n.activo ? "Pausar" : "Activar"}</button>
        <button type="button" class="btn alt chico" id="f-cerrar" aria-label="Cerrar ficha">✕ Cerrar</button>
      </div>
    </div>

    <div class="ficha-grilla">
      <section>
        <h3>Plan y uso</h3>
        ${PLANES.length ? `<label for="f-plan">Plan</label>
          <select id="f-plan" class="sel-plan">${PLANES.map((x) => `<option value="${esc(x.id)}"${x.id === n.plan_id ? " selected" : ""}>${esc(x.nombre)}${Number(x.precio_mensual) > 0 ? ` · ${esc(dinero(x.precio_mensual))}` : ""}</option>`).join("")}</select>` : ""}
        <div class="datos-ficha">
          ${p ? dato("Usuarios", `${(u.usuarios || 0) + (u.invitaciones || 0)} de ${p.max_usuarios}${u.invitaciones ? ` <span class="suave">(${u.invitaciones} invitación${u.invitaciones === 1 ? "" : "es"})</span>` : ""}`) : ""}
          ${p ? dato("Sedes activas", `${u.sedes || 0} de ${p.max_sedes}`) : ""}
          ${p ? dato("Módulos", Object.entries(MODULOS_PLAN).map(([c, t]) => `<span class="${p[c] ? "" : "tachado"}">${p[c] ? "✔" : "✖"} ${esc(t)}</span>`).join("<br>")) : ""}
        </div>
      </section>

      <section>
        <h3>Renovación</h3>
        <div class="datos-ficha">
          ${dato("Estado", `<span class="etiqueta ${est.clase}">${esc(est.texto)}</span>`)}
          ${dato("Próximo pago", ultimo ? esc(fechaPago(ultimo.proximo_pago)) : "—")}
          ${dato("Último pago", ultimo ? `${esc(fechaCorta(ultimo.fecha))} · ${esc(dinero(ultimo.valor))}` : "—")}
          ${dato("Valor del plan", p && Number(p.precio_mensual) > 0 ? `${esc(dinero(p.precio_mensual))}/mes` : '<span class="suave">sin precio</span>')}
          ${dato("Total pagado", `${esc(dinero(totalPagado))} <span class="suave">(${pagos.length} pago${pagos.length === 1 ? "" : "s"})</span>`)}
        </div>
      </section>

      ${conActividad ? `<section>
        <h3>Actividad <span class="suave">(solo conteos)</span></h3>
        <div class="datos-ficha">
          ${dato("Clientes", u.clientes)}
          ${dato("Mascotas", u.mascotas)}
          ${dato("Citas este mes", u.citas_mes)}
          ${dato("Servicios este mes", u.servicios_mes)}
          ${dato("Último servicio", u.ultima_actividad ? esc(fechaCorta(u.ultima_actividad)) : "—")}
          ${dato("Último ingreso", esc(haceCuanto(u.ultimo_ingreso)))}
        </div>
      </section>` : ""}
    </div>

    <section class="ficha-bloque">
      <h3>Usuarios</h3>
      <div id="f-usuarios"><p class="suave">Cargando…</p></div>
      ${invitaciones.length ? `<h4>Invitaciones pendientes</h4>
        <ul class="lista-simple" id="f-invitaciones">${invitaciones.map((i) => `<li>${esc(i.correo)} · ${esc(ROLES[i.rol] || i.rol)}
          <span class="suave">· ${esc(fechaCorta(String(i.creado_en).slice(0, 10)))}</span>
          <button type="button" class="btn alt chico" data-reenviar="${esc(i.correo)}">Reenviar</button></li>`).join("")}</ul>` : ""}
      <form id="form-invitar-negocio" class="fila-form invitar-ficha">
        <div><label for="ni-correo">Invitar a alguien a ${esc(n.nombre)}</label><input id="ni-correo" type="email" required placeholder="correo@empresa.com"></div>
        <div><label for="ni-rol">Rol</label><select id="ni-rol"><option value="administrador">Administrador</option><option value="empleado" selected>Colaborador</option></select></div>
        <button class="btn" type="submit">Invitar</button>
      </form>
      <p id="ni-error" class="error" role="alert"></p>
    </section>

    <section class="ficha-bloque">
      <h3>Pagos de ${esc(n.nombre)}</h3>
      <form id="form-pago" class="fila-form pagos-form">
        <div><label for="np-fecha">Fecha del pago</label><input id="np-fecha" type="date" required value="${hoyISO()}"></div>
        <div><label for="np-valor">Valor</label><input id="np-valor" type="number" min="1" step="1" inputmode="numeric" required></div>
        <div><label for="np-proximo">Próximo pago</label><input id="np-proximo" type="date" required></div>
        <div><label for="np-nota">Nota (opcional)</label><input id="np-nota" maxlength="80" placeholder="Noviembre 2026"></div>
        <button class="btn" type="submit">Registrar pago</button>
      </form>
      <p id="np-ayuda" class="suave"></p>
      <p id="np-error" class="error" role="alert"></p>
      <div id="f-pagos"></div>
    </section>`;

  $("#f-cerrar").addEventListener("click", () => { cerrarFichaNegocio(); pintarListaNegocios(); });
  $("#f-activo").addEventListener("click", () => cambiarActivoNegocio(n));
  if ($("#f-plan")) $("#f-plan").addEventListener("change", () => cambiarPlanNegocio(n, $("#f-plan")));
  $("#form-invitar-negocio").addEventListener("submit", (e) => invitarANegocio(e, n));
  $$("[data-reenviar]", ficha).forEach((b) => b.addEventListener("click", () =>
    abrirEnvioInvitacion(b.dataset.reenviar, n, `Reenviar invitación a ${n.nombre}`)));
  $("#form-pago").addEventListener("submit", (e) => registrarPago(e, n));
  $("#np-fecha").addEventListener("change", () => sugerirProximoPago(n));
  $("#np-valor").addEventListener("input", () => { $("#np-valor").dataset.editado = "1"; });
  sugerirProximoPago(n);
  tablaPagos($("#f-pagos"), pagos, false, "pagos-ficha");
  cargarUsuariosFichaNegocio(n);
}

async function cargarUsuariosFichaNegocio(n) {
  const caja = $("#f-usuarios");
  if (!caja) return;
  let usuarios;
  try {
    usuarios = await q(db.rpc("usuarios_de_negocio", { p_negocio_id: n.id }));
  } catch (error) {
    // Base sin el SQL v17: sin último ingreso
    try { usuarios = await q(db.from("perfiles").select("id,nombre,correo,rol,creado_en").eq("negocio_id", n.id)); }
    catch (fallo) { mostrarError(caja, fallo); return; }
  }
  if (!$("#f-usuarios") || FICHA_ID !== n.id) return;
  caja.innerHTML = usuarios.length ? `<div class="tabla-scroll"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Desde</th><th>Último ingreso</th></tr></thead>
    <tbody>${usuarios.map((x) => `<tr><td>${esc(x.nombre || "—")}</td><td>${esc(x.correo || "")}</td><td>${esc(ROLES[x.rol] || x.rol)}</td>
      <td>${esc(fechaCorta(String(x.creado_en).slice(0, 10)))}</td><td>${"ultimo_ingreso" in x ? esc(haceCuanto(x.ultimo_ingreso)) : "—"}</td></tr>`).join("")}</tbody></table></div>`
    : '<p class="suave">Todavía nadie ha creado su cuenta.</p>';
}

async function cambiarActivoNegocio(negocio) {
  if (!negocio) return;
  const pausar = negocio.activo;
  if (!(await confirmar({
    titulo: pausar ? `¿Pausar ${negocio.nombre}?` : `¿Activar ${negocio.nombre}?`,
    texto: pausar ? "Sus usuarios no podrán entrar hasta que la actives (por ejemplo, por falta de pago). Sus datos no se borran."
      : "Sus usuarios vuelven a poder entrar.",
    boton: pausar ? "Sí, pausar" : "Sí, activar",
  }))) return;
  try {
    const filas = await q(db.from("negocios").update({ activo: !pausar }).eq("id", negocio.id).select("id"));
    if (!filas.length) throw new Error("permission denied");
    aviso(`${negocio.nombre} quedó ${pausar ? "pausada" : "activa"}.`);
    cargarNegocios();
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

async function cambiarPlanNegocio(negocio, select) {
  const plan = PLANES.find((p) => p.id === select.value);
  const u = USO.get(negocio.id);
  const excede = u && plan && (u.sedes > plan.max_sedes || u.usuarios + u.invitaciones > plan.max_usuarios);
  if (!(await confirmar({
    titulo: `¿Pasar ${negocio.nombre} al plan ${plan.nombre}?`,
    texto: `Permite ${plan.max_sedes} ${plan.max_sedes === 1 ? "sede" : "sedes"} y ${plan.max_usuarios} usuarios.` +
      (excede ? " Ojo: hoy usa más de eso. No se borra nada, pero no podrá agregar sedes ni usuarios hasta quedar dentro del límite." : ""),
    boton: "Sí, cambiar",
  }))) { select.value = negocio.plan_id; return; }
  try {
    const filas = await q(db.from("negocios").update({ plan_id: plan.id }).eq("id", negocio.id).select("id"));
    if (!filas.length) throw new Error("permission denied");
    aviso(`${negocio.nombre} quedó en el plan ${plan.nombre}.`);
    cargarNegocios();
  } catch (error) {
    select.value = negocio.plan_id;
    aviso(mensajeError(error), true);
  }
}

/* ---------- Planes ---------- */
// Editor de planes: nombre, precio, límites y módulos (aplica a todas las empresas en ese plan)
function pintarPlanes() {
  const caja = $("#np-planes");
  if (!caja) return;
  if (!PLANES.length) { caja.innerHTML = '<p class="suave">Falta ejecutar el SQL v13 para tener planes.</p>'; return; }
  caja.innerHTML = `<div class="tabla-scroll"><table class="tabla-planes"><thead><tr><th></th>${PLANES.map((p) => `<th>${esc(p.nombre)}</th>`).join("")}</tr></thead>
    <tbody>
      <tr><td>Nombre</td>${PLANES.map((p) => `<td><input type="text" maxlength="30" data-plan-id="${esc(p.id)}" data-campo="nombre" value="${esc(p.nombre)}" aria-label="Nombre del plan ${esc(p.nombre)}"></td>`).join("")}</tr>
      <tr><td>Precio mensual</td>${PLANES.map((p) => `<td><input type="number" min="0" step="1000" inputmode="numeric" data-plan-id="${esc(p.id)}" data-campo="precio_mensual" value="${Number(p.precio_mensual || 0)}" aria-label="Precio mensual del plan ${esc(p.nombre)}"></td>`).join("")}</tr>
      <tr><td>Sedes</td>${PLANES.map((p) => `<td><input type="number" min="1" step="1" data-plan-id="${esc(p.id)}" data-campo="max_sedes" value="${p.max_sedes}" aria-label="Sedes del plan ${esc(p.nombre)}"></td>`).join("")}</tr>
      <tr><td>Usuarios</td>${PLANES.map((p) => `<td><input type="number" min="1" step="1" data-plan-id="${esc(p.id)}" data-campo="max_usuarios" value="${p.max_usuarios}" aria-label="Usuarios del plan ${esc(p.nombre)}"></td>`).join("")}</tr>
      ${Object.entries(MODULOS_PLAN).map(([campo, texto]) => `<tr><td>${esc(texto)}</td>${PLANES.map((p) =>
        `<td><input type="checkbox" data-plan-id="${esc(p.id)}" data-campo="${campo}"${p[campo] ? " checked" : ""} aria-label="${esc(texto)} en ${esc(p.nombre)}"></td>`).join("")}</tr>`).join("")}
    </tbody></table></div>`;
  caja.querySelector("table").addEventListener("change", async (evento) => {
    const entrada = evento.target;
    if (!entrada.dataset.planId) return;
    const esTexto = entrada.type === "text";
    const valor = entrada.type === "checkbox" ? entrada.checked : esTexto ? entrada.value.trim() : Number(entrada.value);
    if (esTexto && !valor) { aviso("El nombre del plan no puede quedar vacío.", true); return cargarNegocios(); }
    const minimo = entrada.dataset.campo === "precio_mensual" ? 0 : 1;
    if (!esTexto && entrada.type !== "checkbox" && !(valor >= minimo)) {
      aviso(minimo ? "Debe ser un número mayor que 0." : "El precio no puede ser negativo.", true);
      return cargarNegocios();
    }
    try {
      const filas = await q(db.from("planes").update({ [entrada.dataset.campo]: valor }).eq("id", entrada.dataset.planId).select("id"));
      if (!filas.length) throw new Error("permission denied");
      PLANES_CACHE = null;
      aviso("Plan actualizado.");
      cargarNegocios();
    } catch (error) {
      aviso(mensajeError(error), true);
      cargarNegocios();
    }
  });
}

/* ---------- Crear e invitar ---------- */
async function crearNegocio(evento) {
  evento.preventDefault();
  const error = $("#nn-error");
  const boton = $("button[type=submit]", evento.target);
  error.textContent = "";
  const nombre = $("#nn-nombre").value.trim();
  const slug = slugDe($("#nn-slug").value || nombre);
  const correo = $("#nn-correo").value.trim().toLowerCase();
  if (!slug) { error.textContent = "Escribe la dirección corta (solo letras, números y guiones)."; return; }
  boton.disabled = true;
  boton.textContent = "Creando…";
  try {
    const datos = { p_nombre: nombre, p_slug: slug, p_correo_admin: correo };
    if ($("#nn-plan") && $("#nn-plan").value) datos.p_plan = $("#nn-plan").value;
    await q(db.rpc("crear_negocio", datos));
    evento.target.reset();
    abrirEnvioInvitacion(correo, { nombre, slug }, `¡${nombre} quedó creado! Envíale la invitación a su administrador`);
    cargarNegocios();
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
  } finally {
    boton.disabled = false;
    boton.textContent = "Crear negocio";
  }
}

async function invitarANegocio(evento, negocio) {
  evento.preventDefault();
  const error = $("#ni-error");
  const boton = $("button[type=submit]", evento.target);
  error.textContent = "";
  boton.disabled = true;
  try {
    const correo = $("#ni-correo").value.trim().toLowerCase();
    const resultado = await q(db.rpc("invitar_usuario", {
      p_correo: correo, p_rol: $("#ni-rol").value, p_negocio_id: negocio.id,
    }));
    $("#ni-correo").value = "";
    if (resultado === "asignado") aviso(`${correo} ya tenía cuenta: quedó en ${negocio.nombre}.`);
    else abrirEnvioInvitacion(correo, negocio, `Invitación lista para ${negocio.nombre}`);
    cargarNegocios();
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
  } finally {
    boton.disabled = false;
  }
}

/* ---------- Pagos ---------- */
function tablaPagos(caja, pagos, conEmpresa, id) {
  if (!caja) return;
  tablaInteractiva(caja, {
    id,
    filas: pagos,
    vacio: conEmpresa ? "Todavía no has registrado pagos." : "Esta empresa todavía no tiene pagos registrados.",
    columnas: [
      { titulo: "Fecha", valor: (p) => p.fecha, filtro: false },
      ...(conEmpresa ? [{ titulo: "Empresa", valor: (p) => nombreNegocioDe(p.negocio_id), filtro: "lista" }] : []),
      { titulo: "Valor", valor: (p) => Number(p.valor), filtro: false },
      { titulo: "Próximo pago", valor: (p) => p.proximo_pago || "", filtro: false },
      { titulo: "Nota", valor: (p) => p.nota ?? "", filtro: "texto" },
      { titulo: "", valor: () => "", filtro: false },
    ],
    fila: (p) => `<tr>
      <td>${esc(fechaCorta(p.fecha))}</td>
      ${conEmpresa ? `<td>${esc(nombreNegocioDe(p.negocio_id))}</td>` : ""}
      <td>${esc(dinero(p.valor))}</td>
      <td>${esc(fechaCorta(p.proximo_pago))}</td>
      <td>${esc(p.nota || "—")}</td>
      <td><button type="button" class="btn alt chico" data-quitar-pago="${p.id}">Quitar</button></td>
    </tr>`,
    alPintar: (tbody) => $$("[data-quitar-pago]", tbody).forEach((b) => b.addEventListener("click", () =>
      quitarPago(pagos.find((p) => p.id === Number(b.dataset.quitarPago))))),
  });
}

function pintarTodosLosPagos() {
  const caja = $("#np-lista");
  if (!caja) return;
  const mes = hoyISO().slice(0, 8) + "01";
  const total = PAGOS.reduce((s, p) => s + Number(p.valor || 0), 0);
  const delMes = PAGOS.filter((p) => p.fecha >= mes).reduce((s, p) => s + Number(p.valor || 0), 0);
  $("#np-totales").innerHTML = `${PAGOS.length} pago${PAGOS.length === 1 ? "" : "s"} · Total recibido <strong>${esc(dinero(total))}</strong> · Este mes <strong>${esc(dinero(delMes))}</strong>`;
  tablaPagos(caja, PAGOS, true, "pagos-dalu");
}

// Sugiere el próximo pago: un mes después del próximo pago anterior (mantiene el día, ej. el 4 de cada mes);
// si es el primer pago, un mes después de la fecha del pago. También sugiere el valor del plan.
function sugerirProximoPago(negocio) {
  const proximo = $("#np-proximo"), fecha = $("#np-fecha");
  if (!proximo || !negocio) return;
  const ultimo = ultimoPagoDe(negocio.id);
  fijarFecha(proximo, ultimo && ultimo.proximo_pago ? masUnMes(ultimo.proximo_pago) : masUnMes(fecha.value || hoyISO()));
  const plan = planDe(negocio);
  if (plan && Number(plan.precio_mensual) > 0 && !$("#np-valor").dataset.editado) $("#np-valor").value = Number(plan.precio_mensual);
  $("#np-ayuda").textContent = ultimo && ultimo.proximo_pago
    ? `El pago anterior quedó para el ${fechaCorta(ultimo.proximo_pago)}.`
    : "Primer pago de esta empresa: elige el día de pago de cada mes.";
}

async function registrarPago(evento, negocio) {
  evento.preventDefault();
  const error = $("#np-error");
  const boton = $("button[type=submit]", evento.target);
  error.textContent = "";
  const valor = Number($("#np-valor").value);
  if (!(valor > 0)) { error.textContent = "Escribe un valor mayor que cero."; return; }
  const proximo = $("#np-proximo").value;
  if (!proximo || proximo <= $("#np-fecha").value) { error.textContent = "El próximo pago debe ser después de la fecha del pago."; return; }
  boton.disabled = true;
  try {
    await q(db.from("pagos").insert({
      negocio_id: negocio.id, fecha: $("#np-fecha").value, valor, nota: $("#np-nota").value.trim() || null,
      proximo_pago: proximo,
    }));
    aviso(`Pago registrado para ${negocio.nombre}. Próximo pago: ${fechaCorta(proximo)}.`);
    await cargarNegocios();
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
  } finally {
    boton.disabled = false;
  }
}

async function quitarPago(pago) {
  if (!pago) return;
  if (!(await confirmar({
    titulo: "¿Quitar este pago?",
    texto: `${nombreNegocioDe(pago.negocio_id)} · ${fechaCorta(pago.fecha)} · ${dinero(pago.valor)}`,
    boton: "Sí, quitar", peligro: true,
  }))) return;
  try {
    await q(db.from("pagos").delete().eq("id", pago.id));
    aviso("Pago quitado.");
    await cargarNegocios();
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

PANTALLAS.negocios = {
  html: () => `<h1>Negocios · DALU</h1>
    <p class="suave">Las empresas que usan ${esc(NOMBRE_PRODUCTO)}. Solo DALU ve esta pantalla; de cada empresa ves conteos, no los datos de sus clientes.</p>
    <div class="stats stats-4" id="n-resumen"></div>
    <div class="tarjeta ficha-empresa" id="n-ficha" hidden></div>
    <div class="tarjeta"><h2>Empresas</h2><div id="n-lista"><p class="suave">Cargando…</p></div></div>

    <details class="tarjeta plegable">
      <summary><h2>Crear una empresa</h2></summary>
      <form id="form-negocio" class="form-angosto">
        <label for="nn-nombre">Nombre de la empresa</label>
        <input id="nn-nombre" maxlength="60" required placeholder="Veterinaria San Roque">
        <label for="nn-slug">Dirección corta (para su enlace)</label>
        <input id="nn-slug" maxlength="40" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="veterinaria-san-roque"
          title="Solo minúsculas, números y guiones">
        <p class="suave" id="nn-vista"></p>
        <label for="nn-correo">Correo de su administrador</label>
        <input id="nn-correo" type="email" required>
        <label for="nn-plan">Plan</label>
        <select id="nn-plan"></select>
        <p id="nn-error" class="error" role="alert"></p>
        <button class="btn" type="submit">Crear negocio</button>
      </form>
    </details>

    <details class="tarjeta plegable">
      <summary><h2>Planes</h2></summary>
      <p class="suave">Nombre, precio, límites y módulos de cada plan. Un cambio aquí aplica a todas las empresas de ese plan
      y es lo que ven en «Suscripción». La base no deja pasar de los límites de sedes y usuarios.</p>
      <div id="np-planes"><p class="suave">Cargando…</p></div>
    </details>

    <details class="tarjeta plegable">
      <summary><h2>Todos los pagos</h2></summary>
      <p class="suave">Solo para ti. Para registrar un pago, abre la ficha de la empresa.</p>
      <p id="np-totales"></p>
      <div id="np-lista"><p class="suave">Cargando…</p></div>
    </details>`,
  despues: () => {
    const nombre = $("#nn-nombre"), slug = $("#nn-slug"), vista = $("#nn-vista");
    let slugEditado = false;
    const mostrar = () => { vista.textContent = slug.value ? `Su enlace: ${enlacePublico(slug.value)}` : ""; };
    nombre.addEventListener("input", () => { if (!slugEditado) { slug.value = slugDe(nombre.value); mostrar(); } });
    slug.addEventListener("input", () => { slugEditado = true; mostrar(); });
    $("#form-negocio").addEventListener("submit", crearNegocio);
    FICHA_ID = null;
    return cargarNegocios();
  },
};
