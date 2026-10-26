"use strict";

/* =====================================================================
   HOY: citas del día y a quién buscar
   (nombreNegocio() se define en app.js)
   ===================================================================== */

// "Descartar" quita a la mascota de "A quién buscar" solo para ESTE ciclo:
// cuando tenga un servicio nuevo, la próxima vez que le toque vuelve a aparecer.
let verDescartados = false;
const claveDescarte = (x) => `${x.mascota_id}|${x.grupo}|${x.ultima_fecha}`;

async function descartarPendiente(p) {
  try {
    const filas = await q(db.from("pendientes_descartados")
      .insert({ mascota_id: p.mascota_id, grupo: p.grupo, ultima_fecha: p.ultima_fecha }).select("id"));
    await cargarHoy();
    aviso(`${p.mascota} salió de la lista hasta su próximo servicio.`, false, {
      texto: "Deshacer",
      alHacer: () => restaurarPendiente(filas[0].id),
    });
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

async function restaurarPendiente(idDescarte) {
  try {
    await q(db.from("pendientes_descartados").delete().eq("id", idDescarte));
    await cargarHoy();
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

async function cargarHoy() {
  const hoy = hoyISO();
  const mes = hoy.slice(0, 8) + "01";
  let citas, todosPendientes, serviciosMes, descartes = [];
  try {
    [citas, todosPendientes, serviciosMes] = await Promise.all([
      q(conSede(db.from("agenda").select("*"))
        .gte("fecha_hora", inicioDiaBogota(hoy)).lt("fecha_hora", inicioDiaBogota(sumarDias(hoy, 1)))
        .neq("estado", "cancelada").order("fecha_hora")),
      moduloActivo("recordatorios")
        ? q(db.from("pendientes").select("*").order("dias_de_retraso", { ascending: false }))
        : Promise.resolve([]),
      contar(conSede(db.from("servicios").select("id", { count: "exact", head: true })).gte("fecha", mes)),
    ]);
  } catch (error) {
    mostrarError($("#h-citas"), error);
    return;
  }
  try {
    descartes = await q(db.from("pendientes_descartados").select("id,mascota_id,grupo,ultima_fecha"));
  } catch (error) { /* si la tabla aún no existe, se muestran todos */ }
  if (!$("#h-citas")) return; // cambiaste de pantalla

  // Con sedes: cada sede busca a los clientes cuyo último servicio fue en ella.
  if (estado.conSedes && estado.sede) todosPendientes = todosPendientes.filter((p) => p.ultima_sede_id == null || p.ultima_sede_id === estado.sede.id);
  const idDescarte = new Map(descartes.map((d) => [claveDescarte(d), d.id]));
  const pendientes = todosPendientes.filter((p) => !idDescarte.has(claveDescarte(p)));
  const descartados = todosPendientes.filter((p) => idDescarte.has(claveDescarte(p)));

  const clientesPorBuscar = new Set(pendientes.map((p) => p.cliente_id)).size;
  $("#h-stats").innerHTML = `
    <div class="stat"><b>${citas.length}</b>Citas de hoy</div>
    <div class="stat"><b>${clientesPorBuscar}</b>Clientes por buscar</div>
    <div class="stat"><b>${serviciosMes}</b>Servicios este mes</div>`;

  $("#h-citas").innerHTML = citas.length ? citas.map((c) => `<div class="item">
      <div><strong>${esc(horaTexto(c.fecha_hora))} ·</strong>
        <button class="enlace" data-ficha="${c.mascota_id}" title="Ver ficha e historial">${esc(c.mascota)}</button>
        <span class="suave">${esc(c.cliente)}</span>
        <div class="suave">${esc(c.servicio ?? "sin servicio")}${c.medicado ? " (medicado)" : ""} · ${dinero(c.estado === "realizada" ? c.precio_cobrado : (c.precio_acordado ?? c.precio))}</div></div>
      <div class="acciones-tabla">${c.estado === "pendiente"
        ? `<button class="btn chico" data-terminar="${c.id}">Terminar</button>
           <button class="btn chico alt" data-recordar="${c.id}" title="Enviar recordatorio de la cita por WhatsApp">Recordar</button>${botonMenu(c.id)}`
        : `<span class="etiqueta ok">${esc(c.estado)}</span>
           <button class="btn chico alt" data-recoger="${c.id}" title="Avisar por WhatsApp que ya puede recogerlo">Avisar</button>${botonMenu(c.id)}`}</div>
    </div>`).join("") : '<p class="suave">No tienes citas para hoy.</p>';

  $$("[data-terminar]", $("#h-citas")).forEach((b) => b.addEventListener("click", () =>
    abrirTerminarCita(citas.find((c) => c.id === Number(b.dataset.terminar)), cargarHoy)));
  $$("[data-recoger]", $("#h-citas")).forEach((b) => b.addEventListener("click", () =>
    abrirAvisoRecoger(citas.find((c) => c.id === Number(b.dataset.recoger)))));
  $$("[data-recordar]", $("#h-citas")).forEach((b) => b.addEventListener("click", () =>
    abrirRecordatorioCita(citas.find((c) => c.id === Number(b.dataset.recordar)))));
  $$("[data-menu]", $("#h-citas")).forEach((b) => b.addEventListener("click", () =>
    abrirMenu(b, opcionesCita(citas.find((c) => c.id === Number(b.dataset.menu)), cargarHoy))));

  if (!$("#h-pendientes")) return; // el plan no incluye recordatorios
  $("#h-pendientes").innerHTML = pendientes.length ? pendientes.map((p, i) => {
    const retraso = p.dias_de_retraso;
    return `<div class="item">
      <div><button class="enlace" data-ficha="${p.mascota_id}" title="Ver ficha e historial">${esc(p.mascota)}</button>
        <span class="suave">${esc(p.cliente)}</span>
        <div class="suave">${esc(p.grupo)} · último: ${esc(fechaTexto(p.ultima_fecha))}</div></div>
      <div class="acciones-tabla">
        <span class="etiqueta ${retraso > 0 ? "atrasada" : ""}">${retraso <= 0 ? "Toca hoy" : `Hace ${retraso} ${retraso === 1 ? "día" : "días"}`}</span>
        <button class="btn chico" data-whatsapp="${i}">WhatsApp</button>
        <button class="btn chico alt" data-agendar="${i}">Agendar</button>
        <button class="btn chico alt solo-icono" data-descartar="${i}" title="Descartar: quitar de esta lista hasta su próximo servicio" aria-label="Descartar ${esc(p.mascota)}">✕</button>
      </div></div>`;
  }).join("") : '<p class="suave">Nadie por buscar por ahora.</p>';

  // Descartados: se pueden ver y volver a poner en la lista.
  $("#h-descartados").innerHTML = descartados.length ? `
    <label class="casilla"><input type="checkbox" id="h-ver-descartados"${verDescartados ? " checked" : ""}>
      Ver descartados (${descartados.length})</label>
    ${verDescartados ? descartados.map((p) => `<div class="item descartado">
      <div><button class="enlace" data-ficha="${p.mascota_id}">${esc(p.mascota)}</button>
        <span class="suave">${esc(p.cliente)} · último: ${esc(fechaTexto(p.ultima_fecha))}</span></div>
      <button class="btn chico alt" data-restaurar="${idDescarte.get(claveDescarte(p))}">Volver a la lista</button></div>`).join("") : ""}` : "";
  const casillaDescartados = $("#h-ver-descartados");
  if (casillaDescartados) casillaDescartados.addEventListener("change", (e) => { verDescartados = e.target.checked; cargarHoy(); });
  $$("[data-restaurar]", $("#h-descartados")).forEach((b) => b.addEventListener("click", () =>
    restaurarPendiente(Number(b.dataset.restaurar))));
  $$("[data-descartar]", $("#h-pendientes")).forEach((b) => b.addEventListener("click", () =>
    descartarPendiente(pendientes[Number(b.dataset.descartar)])));

  $$("[data-ficha]", $("#pantalla")).forEach((b) => b.addEventListener("click", () =>
    abrirFichaEnDialogo(Number(b.dataset.ficha), cargarHoy)));

  $$("[data-whatsapp]", $("#h-pendientes")).forEach((b) => b.addEventListener("click", () => {
    const p = pendientes[Number(b.dataset.whatsapp)];
    const mensaje = `¡Hola, ${primerNombre(p.cliente)}!

Recibe un cordial saludo de parte de ${nombreNegocio()}.

Queremos agradecerte por permitirnos cuidar y consentir a ${p.mascota} en su última visita el ${fechaMensaje(p.ultima_fecha)}. ¡Fue un placer atenderlos!

Nos encantaría volver a recibir a tu peludito para su próximo servicio de ${p.grupo.toLowerCase()}.

Esperamos verlos muy pronto y seguir compartiendo momentos especiales con ustedes.

¿Te gustaría agendar una cita para esta semana?`;
    window.open(enlaceWhatsApp(p.telefono, mensaje), "_blank", "noopener");
  }));

  $$("[data-agendar]", $("#h-pendientes")).forEach((b) => b.addEventListener("click", () => {
    const p = pendientes[Number(b.dataset.agendar)];
    estado.agendarPrefill = { mascota: p.mascota, telefono: p.telefono };
    location.hash = "#/agendar";
  }));
}

PANTALLAS.hoy = {
  html: () => `<h1>Hoy</h1>
    <p class="suave">Lo que tienes que hacer y a quién escribirle. Haz clic en el nombre de una mascota para ver su ficha.</p>
    <div id="h-renovacion"></div>
    <div class="stats" id="h-stats"></div>
    <div class="columnas">
      <div class="tarjeta"><h2>Citas de hoy</h2><div id="h-citas"><p class="suave">Cargando…</p></div></div>
      ${moduloActivo("recordatorios") ? `<div class="tarjeta"><h2>A quién buscar hoy</h2><div id="h-pendientes"><p class="suave">Cargando…</p></div>
        <div id="h-descartados" class="descartados"></div></div>` : ""}
    </div>`,
  despues: () => { avisoRenovacion(); return cargarHoy(); },
};

// Recordatorio suave para el administrador: 3 días antes de renovar el plan, o si quedó pendiente.
// Se puede cerrar (vuelve a salir al otro día si sigue pendiente).
async function avisoRenovacion() {
  const caja = $("#h-renovacion");
  if (!caja || estado.rol !== "administrador") return;
  let datos = null;
  try { datos = (await q(db.rpc("mi_suscripcion")))[0] || null; } catch (error) { return; }
  if (!datos || !datos.proximo_pago || !$("#h-renovacion")) return;
  const est = estadoPago(datos.proximo_pago);
  if (!est.aviso) return;
  const clave = `dalu-vital-renovacion-${estado.negocio ? estado.negocio.id : 0}-${datos.proximo_pago}-${est.dias < 0 ? hoyISO() : ""}`;
  try { if (localStorage.getItem(clave)) return; } catch (error) { /* sin almacenamiento: se muestra */ }
  const texto = est.dias > 0 ? `Tu plan ${esc(datos.plan || "")} se renueva el ${esc(fechaPago(datos.proximo_pago))}.`
    : est.dias === 0 ? `Tu plan ${esc(datos.plan || "")} se renueva hoy.`
    : `Tu renovación del plan ${esc(datos.plan || "")} está pendiente desde el ${esc(fechaPago(datos.proximo_pago))}.`;
  caja.innerHTML = `<div class="aviso-fijo aviso-renovacion" role="status">
    <span>🔔 ${texto}</span>
    <span class="acciones-tabla"><a class="btn chico" href="#/suscripcion">Ver cómo pagar</a>
    <button type="button" class="btn alt chico" id="h-renovacion-cerrar" aria-label="Cerrar aviso">✕</button></span></div>`;
  $("#h-renovacion-cerrar").addEventListener("click", () => {
    try { localStorage.setItem(clave, "1"); } catch (error) { /* nada */ }
    caja.innerHTML = "";
  });
}