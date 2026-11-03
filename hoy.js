"use strict";

/* =====================================================================
   HOY: citas del día y a quién buscar
   (nombreNegocio() se define en app.js)
   ===================================================================== */

// "Descartar" quita a la mascota de "A quién buscar" solo para ESTE ciclo:
// cuando tenga un servicio nuevo, la próxima vez que le toque vuelve a aparecer.
let verDescartados = false;
// "A quién buscar" es larga: se divide en tramos según cuánto llevan sin volver,
// se muestran de a 10 y se puede buscar por mascota o dueño.
const TRAMOS_BUSCAR = [
  { id: "recientes", nombre: "Hasta 30 días", entra: (d) => d <= 30 },
  { id: "meses", nombre: "1 a 3 meses", entra: (d) => d > 30 && d <= 90 },
  { id: "viejos", nombre: "Más de 3 meses", entra: (d) => d > 90 },
];
const PASO_BUSCAR = 10;
let tramoBuscar = null;   // null = el primero que tenga gente
let textoBuscar = "";
let cuantosBuscar = PASO_BUSCAR;
const claveDescarte = (x) => `${x.mascota_id}|${x.grupo}|${x.ultima_fecha}`;

/* ---------- La jornada: saludo, resumen y línea de tiempo ---------- */
function saludoDelDia() {
  const hora = Number(new Date().toLocaleString("en-GB", { timeZone: ZONA, hour: "2-digit", hourCycle: "h23" }));
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const nombre = primerNombre(nombreUsuario());
  return nombre ? `${saludo}, ${nombre}` : saludo;
}

// precioCita(c) viene de agenda.js
const cuenta = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Une partes como en una frase: "a", "a y b", "a, b y c".
function enFrase(partes) {
  return partes.length < 2 ? partes.join("") : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

// Una frase con lo importante del día, en lugar de recuadros con cifras.
function resumenDelDia(citas, serviciosMes) {
  const fecha = fechaLarga().replace(",", "");
  let texto = `Es ${esc(fecha)}. `;
  if (!citas.length) {
    texto += "No tienes citas para hoy.";
  } else {
    const hechas = citas.filter((c) => c.estado === "realizada").length;
    const faltan = citas.length - hechas;
    const partes = [];
    if (hechas) partes.push(hechas === 1 ? "una ya terminó" : `${hechas} ya terminaron`);
    if (faltan) partes.push(faltan === 1 ? "queda una por atender" : `quedan ${faltan} por atender`);
    texto += `Tienes <strong>${cuenta(citas.length, "cita", "citas")}</strong>: ${enFrase(partes)}.`;
    const porCobrar = citas.filter((c) => c.estado === "pendiente").reduce((suma, c) => suma + (Number(precioCita(c)) || 0), 0);
    if (porCobrar) texto += ` Faltan <strong>${dinero(porCobrar)}</strong> por cobrar.`;
  }
  if (serviciosMes) texto += serviciosMes === 1 ? " En el mes va 1 servicio." : ` En el mes van ${serviciosMes} servicios.`;
  return texto;
}

// Citas del día en una línea de tiempo. Todas tienen la misma altura (no se usa la duración).
// La línea amarilla "ahora" queda entre la última cita que ya empezó y la siguiente.
// La cita "actual" es la última pendiente cuya hora ya llegó: se resalta y su botón Terminar es el principal.
function htmlJornada(citas) {
  if (!citas.length) return '<p class="suave jornada-vacia">No tienes citas para hoy.</p>';
  const ahora = Date.now();
  const yaEmpezaron = citas.filter((c) => Date.parse(c.fecha_hora) <= ahora);
  const pendientesQueLlegaron = yaEmpezaron.filter((c) => c.estado === "pendiente");
  const actual = pendientesQueLlegaron.length ? pendientesQueLlegaron[pendientesQueLlegaron.length - 1] : null;
  const lineaAhora = `<div class="jornada-ahora" role="presentation"><b>${esc(horaTexto(new Date(ahora).toISOString()))}</b><i></i></div>`;

  let html = "";
  let lineaPuesta = false;
  citas.forEach((c) => {
    if (!lineaPuesta && Date.parse(c.fecha_hora) > ahora) { html += lineaAhora; lineaPuesta = true; }
    const [hora, ...ampm] = horaTexto(c.fecha_hora).split(" ");
    const hecha = c.estado === "realizada";
    const esActual = actual && c.id === actual.id;
    const detalle = [c.servicio ?? "Sin servicio", c.guia ? `guía ${c.guia}` : ""].filter(Boolean).join(", ");
    const acciones = hecha
      ? `<button class="btn chico alt" data-recoger="${c.id}" title="Avisar por WhatsApp que ya puede recogerlo">Avisar</button>${botonMenu(c.id)}`
      : `<button class="btn chico${esActual ? "" : " alt"}" data-terminar="${c.id}">${esActual ? icono("check", { tam: 16 }) : ""}Terminar</button>
         <button class="btn chico alt" data-recordar="${c.id}" title="Enviar recordatorio de la cita por WhatsApp">Recordar</button>${botonMenu(c.id)}`;
    html += `<div class="jornada-cita${hecha ? " hecha" : ""}${esActual ? " actual" : ""}">
      <div class="jornada-hora" aria-label="${esc(horaTexto(c.fecha_hora))}"><b>${esc(hora)}</b><span>${esc(ampm.join(" "))}</span></div>
      <div class="jornada-punto" aria-hidden="true">${hecha ? icono("check", { tam: 10 }) : ""}</div>
      <div class="jornada-datos">
        <div class="jornada-titulo">${iconoEspecie(c.especie)}<button class="enlace jornada-nombre" data-ficha="${c.mascota_id}" title="Ver ficha e historial">${esc(c.mascota)}</button>
          ${c.medicado ? '<span class="nota-cita medicado">Medicado</span>' : ""}
          ${hecha ? '<span class="nota-cita terminada">Terminada</span>' : ""}</div>
        <div class="jornada-sub">De ${esc(c.cliente)}. ${esc(detalle)}.</div>
      </div>
      <div class="jornada-der"><span class="jornada-precio">${dinero(precioCita(c))}</span><span class="jornada-acciones">${acciones}</span></div>
    </div>`;
  });
  if (!lineaPuesta) html += lineaAhora;
  return html;
}

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
  // Mascotas que YA tienen una cita pendiente (de hoy en adelante) para ese mismo grupo de servicios:
  // no hay que buscarlas, ya vienen. Una cita sin servicio cuenta para todos los grupos.
  let yaAgendadas = new Set();
  if (todosPendientes.length) {
    try {
      const [proximas, tipos, grupos] = await Promise.all([
        q(db.from("citas").select("mascota_id,tipo_id").eq("estado", "pendiente").gte("fecha_hora", inicioDiaBogota(hoy))),
        q(db.from("tipos_servicio").select("id,grupo_id")),
        q(db.from("grupos_recordatorio").select("id,nombre")),
      ]);
      const grupoDeTipo = new Map(tipos.map((t) => [t.id, (grupos.find((g) => g.id === t.grupo_id) || {}).nombre]));
      yaAgendadas = new Set(proximas.map((c) => `${c.mascota_id}|${c.tipo_id ? grupoDeTipo.get(c.tipo_id) ?? "*" : "*"}`));
    } catch (error) { /* si falla, se muestran todos como antes */ }
  }
  const tieneCita = (p) => yaAgendadas.has(`${p.mascota_id}|${p.grupo}`) || yaAgendadas.has(`${p.mascota_id}|*`);
  todosPendientes = todosPendientes.filter((p) => !tieneCita(p));
  if (!$("#h-citas")) return; // cambiaste de pantalla

  // Con sedes: cada sede busca a los clientes cuyo último servicio fue en ella.
  if (estado.conSedes && estado.sede) todosPendientes = todosPendientes.filter((p) => p.ultima_sede_id == null || p.ultima_sede_id === estado.sede.id);
  const idDescarte = new Map(descartes.map((d) => [claveDescarte(d), d.id]));
  const pendientes = todosPendientes.filter((p) => !idDescarte.has(claveDescarte(p)));
  const descartados = todosPendientes.filter((p) => idDescarte.has(claveDescarte(p)));

  $("#h-resumen").innerHTML = resumenDelDia(citas, serviciosMes);
  $("#h-citas").innerHTML = htmlJornada(citas);

  $$("[data-terminar]", $("#h-citas")).forEach((b) => b.addEventListener("click", () =>
    abrirTerminarCita(citas.find((c) => c.id === Number(b.dataset.terminar)), cargarHoy)));
  $$("[data-recoger]", $("#h-citas")).forEach((b) => b.addEventListener("click", () =>
    abrirAvisoRecoger(citas.find((c) => c.id === Number(b.dataset.recoger)))));
  $$("[data-recordar]", $("#h-citas")).forEach((b) => b.addEventListener("click", () =>
    abrirRecordatorioCita(citas.find((c) => c.id === Number(b.dataset.recordar)))));
  $$("[data-menu]", $("#h-citas")).forEach((b) => b.addEventListener("click", () =>
    abrirMenu(b, opcionesCita(citas.find((c) => c.id === Number(b.dataset.menu)), cargarHoy))));

  if (!$("#h-pendientes")) return; // el plan no incluye recordatorios
  $("#h-cuantos-buscar").textContent = pendientes.length ? `(${pendientes.length})` : "";
  const porTramo = TRAMOS_BUSCAR.map((t) => ({ ...t, lista: pendientes.filter((p) => t.entra(p.dias_de_retraso)) }));
  if (!tramoBuscar || !porTramo.some((t) => t.id === tramoBuscar && t.lista.length)) {
    tramoBuscar = (porTramo.find((t) => t.lista.length) || porTramo[0]).id;
  }
  $("#h-buscar-controles").innerHTML = pendientes.length ? `
    <div class="filtros tramos-buscar" role="group" aria-label="Cuánto llevan sin volver">${porTramo.map((t) =>
      `<button type="button" class="chip" data-tramo="${t.id}" aria-pressed="${!textoBuscar && t.id === tramoBuscar}"${t.lista.length ? "" : " disabled"}>${t.nombre} (${t.lista.length})</button>`).join("")}</div>
    <input type="search" id="h-buscar-texto" class="buscar-lista" placeholder="Buscar mascota o dueño en la lista" value="${esc(textoBuscar)}" aria-label="Buscar en A quién buscar">` : "";

  const pintarPendientes = () => {
    const texto = sinTildes(textoBuscar);
    const lista = texto
      ? pendientes.filter((p) => sinTildes(`${p.mascota} ${p.cliente}`).includes(texto))
      : porTramo.find((t) => t.id === tramoBuscar).lista;
    const visibles = lista.slice(0, cuantosBuscar);
    $("#h-pendientes").innerHTML = !pendientes.length ? '<p class="suave">Nadie por buscar por ahora.</p>'
      : !lista.length ? `<p class="suave">Nadie coincide con «${esc(textoBuscar)}».</p>`
      : visibles.map((p) => {
      const i = pendientes.indexOf(p);
      const retraso = p.dias_de_retraso;
      // Urgencia: toca hoy (azul), hasta 30 días (amarillo), más de 30 días (rojo).
      const urgencia = retraso <= 0 ? "hoy" : retraso <= 30 ? "leve" : "atrasada";
      const cuando = retraso <= 0 ? "le toca hoy" : `${cuenta(retraso, "día", "días")} tarde`;
      return `<div class="buscar-item">
        <div class="buscar-datos">
          <div class="buscar-titulo">${iconoEspecie(p.especie, 17)}<button class="enlace buscar-nombre" data-ficha="${p.mascota_id}" title="Ver ficha e historial">${esc(p.mascota)}</button></div>
          <div class="buscar-sub">De ${esc(p.cliente)}, ${esc(p.grupo.toLowerCase())}, <span class="retraso ${urgencia}">${cuando}</span>. Vino el ${esc(fechaTexto(p.ultima_fecha))}.</div>
        </div>
        <div class="buscar-acciones">
          <button class="btn chico wa solo-icono" data-whatsapp="${i}" title="Escribirle por WhatsApp" aria-label="Escribirle por WhatsApp a ${esc(p.cliente)}">${icono("whatsapp", { tam: 18 })}</button>
          <button class="btn chico alt" data-agendar="${i}">Agendar</button>
          <button class="btn chico alt solo-icono" data-descartar="${i}" title="Descartar: quitar de esta lista hasta su próximo servicio" aria-label="Descartar ${esc(p.mascota)}">✕</button>
        </div></div>`;
    }).join("");
    const faltan = lista.length - visibles.length;
    $("#h-buscar-mas").innerHTML = faltan > 0
      ? `<button type="button" class="btn alt chico ver-mas" id="h-ver-mas">Ver ${Math.min(PASO_BUSCAR, faltan)} más <span class="suave">(quedan ${faltan})</span></button>` : "";
    const verMas = $("#h-ver-mas");
    if (verMas) verMas.addEventListener("click", () => { cuantosBuscar += PASO_BUSCAR; pintarPendientes(); });
    conectarPendientes();
  };

  // Botones de cada persona (se conectan cada vez que se pinta la lista)
  const conectarPendientes = () => {
    $$("[data-descartar]", $("#h-pendientes")).forEach((b) => b.addEventListener("click", () =>
      descartarPendiente(pendientes[Number(b.dataset.descartar)])));
    $$("[data-ficha]", $("#h-pendientes")).forEach((b) => b.addEventListener("click", () =>
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
  };

  $$("[data-tramo]", $("#h-buscar-controles")).forEach((b) => b.addEventListener("click", () => {
    tramoBuscar = b.dataset.tramo; textoBuscar = ""; cuantosBuscar = PASO_BUSCAR;
    $("#h-buscar-texto").value = "";
    $$("[data-tramo]", $("#h-buscar-controles")).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    pintarPendientes();
  }));
  const cajaTexto = $("#h-buscar-texto");
  if (cajaTexto) cajaTexto.addEventListener("input", () => {
    textoBuscar = cajaTexto.value; cuantosBuscar = PASO_BUSCAR;
    $$("[data-tramo]", $("#h-buscar-controles")).forEach((x) => x.setAttribute("aria-pressed", String(!textoBuscar && x.dataset.tramo === tramoBuscar)));
    pintarPendientes();
  });
  pintarPendientes();

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
  $$("[data-ficha]", $("#h-citas")).forEach((b) => b.addEventListener("click", () =>
    abrirFichaEnDialogo(Number(b.dataset.ficha), cargarHoy)));
  $$("[data-ficha]", $("#h-descartados")).forEach((b) => b.addEventListener("click", () =>
    abrirFichaEnDialogo(Number(b.dataset.ficha), cargarHoy)));
}

PANTALLAS.hoy = {
  html: () => `<header class="hoy-cabeza">
      <h1 id="h-saludo">${esc(saludoDelDia())}</h1>
      <p class="hoy-resumen" id="h-resumen">Es ${esc(fechaLarga().replace(",", ""))}.</p>
    </header>
    <div id="h-renovacion"></div>
    <div class="hoja-hoy${moduloActivo("recordatorios") ? "" : " sin-lado"}">
      <section class="jornada" aria-labelledby="h-titulo-citas">
        <h2 id="h-titulo-citas" class="oculto-visual">Citas de hoy</h2>
        <div id="h-citas" class="jornada-riel"><p class="suave">Cargando…</p></div>
      </section>
      ${moduloActivo("recordatorios") ? `<section class="lado-hoy" aria-labelledby="h-titulo-buscar">
        <h2 id="h-titulo-buscar">A quién buscar hoy <span class="suave" id="h-cuantos-buscar"></span></h2>
        <p class="suave lado-ayuda">Clientes a los que ya les toca volver.</p>
        <div id="h-buscar-controles"></div>
        <div id="h-pendientes" class="lista-buscar"><p class="suave">Cargando…</p></div>
        <div id="h-buscar-mas"></div>
        <div id="h-descartados" class="descartados"></div></section>` : ""}
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
  const texto = esc(textoAvisoPago(datos.proximo_pago, datos.plan || ""));
  caja.innerHTML = `<div class="aviso-fijo aviso-renovacion${est.dias < 0 ? " atrasada" : ""}" role="status">
    <span>${texto}</span>
    <span class="acciones-tabla"><a class="btn chico" href="#/suscripcion">Ver cómo pagar</a>
    <button type="button" class="btn alt chico" id="h-renovacion-cerrar" aria-label="Cerrar aviso">✕</button></span></div>`;
  $("#h-renovacion-cerrar").addEventListener("click", () => {
    try { localStorage.setItem(clave, "1"); } catch (error) { /* nada */ }
    caja.innerHTML = "";
  });
}