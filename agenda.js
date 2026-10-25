"use strict";

/* =====================================================================
   AGENDA, "Terminar cita" y "Editar cita" (también se usan desde Hoy)
   ===================================================================== */

// Cambiar el estado de la cita a "realizada" es UNA sola actualización:
// la base de datos crea sola el servicio en el historial.
async function abrirTerminarCita(cita, alGuardar) {
  let guias, ultima;
  try {
    [guias, ultima] = await Promise.all([
      q(db.from("guias").select("id,nombre").order("nombre")),
      q(db.from("ultima_guia").select("guia_id").eq("mascota_id", cita.mascota_id)),
    ]);
  } catch (error) {
    aviso(mensajeError(error), true);
    return;
  }
  const guiaPrevia = ultima.length ? ultima[0].guia_id : null;
  const precio = cita.precio_acordado ?? cita.precio ?? "";
  const bano = SERVICIOS_CON_BANO.includes(cita.servicio);

  abrirDialogo(`<form id="form-terminar">
    <h2>Terminar cita</h2>
    <p><strong>${esc(cita.mascota)}</strong> · ${esc(cita.servicio ?? "sin servicio")} · ${esc(fechaHoraTexto(cita.fecha_hora))}</p>
    <label for="t-guia">Guía usada${guiaPrevia ? " (viene la de la última vez)" : ""}</label>
    <select id="t-guia"><option value="">(sin guía)</option>${guias.map((g) =>
      `<option value="${g.id}"${g.id === guiaPrevia ? " selected" : ""}>${esc(g.nombre)}</option>`).join("")}</select>
    <label for="t-precio">Precio cobrado</label>
    <input id="t-precio" type="number" min="0" step="any" value="${esc(precio)}">
    ${bano ? htmlMedicado("t", cita.medicado, cita.recargo_medicado ?? "") : ""}
    <label for="t-notas">Notas del servicio</label>
    <input id="t-notas" maxlength="300">
    <p id="t-error" class="error" role="alert"></p>
    <div class="acciones">
      <button type="button" class="btn alt" id="t-volver">Volver</button>
      <button type="submit" class="btn">Marcar como realizada</button>
    </div>
  </form>`);

  if (bano) conectarMedicado("t", "#t-precio");
  $("#t-volver").addEventListener("click", () => cerrarDialogo());
  $("#form-terminar").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const boton = $("button[type=submit]", evento.target);
    boton.disabled = true;
    const medicado = bano && $("#t-medicado").checked;
    try {
      await q(db.from("citas").update({
        estado: "realizada",
        guia_id: $("#t-guia").value ? Number($("#t-guia").value) : null,
        precio_cobrado: $("#t-precio").value === "" ? null : Number($("#t-precio").value),
        notas_servicio: $("#t-notas").value.trim() || null,
        medicado,
        recargo_medicado: medicado && $("#t-recargo").value !== "" ? Number($("#t-recargo").value) : null,
      }).eq("id", cita.id));
      cerrarDialogo();
      if (alGuardar) alGuardar();
      // Ventana para avisarle al dueño por WhatsApp que ya puede recoger la mascota.
      abrirAvisoRecoger(cita);
    } catch (error) {
      $("#t-error").textContent = mensajeError(error);
      boton.disabled = false;
    }
  });
}

// Cambiar día, hora, servicio, precio o baño medicado de una cita pendiente.
async function editarCita(cita, alGuardar) {
  let tipos;
  try {
    tipos = await q(db.from("tipos_servicio").select("id,nombre").order("id"));
  } catch (error) {
    aviso(mensajeError(error), true);
    return;
  }
  const esBano = () => {
    const t = tipos.find((x) => x.id === Number($("#e-servicio").value));
    return !!t && SERVICIOS_CON_BANO.includes(t.nombre);
  };

  abrirDialogo(`<form id="form-cita">
    <h2>Editar cita</h2>
    <p><strong>${esc(cita.mascota)}</strong> · ${esc(cita.cliente)}</p>
    <div class="dos">
      <div><label for="e-dia">Día</label><input id="e-dia" type="date" value="${diaDe(cita.fecha_hora)}" required></div>
      <div><label for="e-hora">Hora</label><select id="e-hora">${opcionesHora(horaDe(cita.fecha_hora))}</select></div>
    </div>
    <label for="e-servicio">Servicio</label>
    <select id="e-servicio">${tipos.map((t) =>
      `<option value="${t.id}"${t.id === cita.tipo_id ? " selected" : ""}>${esc(t.nombre)}</option>`).join("")}</select>
    <label for="e-precio">Precio acordado</label>
    <input id="e-precio" type="number" min="0" step="any" value="${esc(cita.precio_acordado ?? "")}">
    ${htmlMedicado("e", cita.medicado, cita.recargo_medicado ?? "")}
    <label for="e-motivo">Motivo</label>
    <input id="e-motivo" value="${esc(cita.motivo ?? "")}" maxlength="200">
    <p id="e-error" class="error" role="alert"></p>
    <div class="acciones">
      <button type="button" class="btn alt" id="e-volver">Volver</button>
      <button type="submit" class="btn">Guardar cambios</button>
    </div>
  </form>`);

  $("#e-bloque").hidden = !esBano();
  conectarMedicado("e", "#e-precio");
  $("#e-servicio").addEventListener("change", () => {
    const si = esBano();
    $("#e-bloque").hidden = !si;
    if (!si && $("#e-medicado").checked) {
      $("#e-medicado").checked = false;
      $("#e-medicado").dispatchEvent(new Event("change"));
    }
  });
  $("#e-volver").addEventListener("click", () => cerrarDialogo());
  $("#form-cita").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const medicado = esBano() && $("#e-medicado").checked;
    try {
      await q(db.from("citas").update({
        tipo_id: Number($("#e-servicio").value),
        fecha_hora: bogotaAISO(`${$("#e-dia").value}T${$("#e-hora").value}`),
        precio_acordado: $("#e-precio").value === "" ? null : Number($("#e-precio").value),
        motivo: $("#e-motivo").value.trim() || null,
        medicado,
        recargo_medicado: medicado && $("#e-recargo").value !== "" ? Number($("#e-recargo").value) : null,
      }).eq("id", cita.id));
      cerrarDialogo();
      aviso("Cita actualizada.");
      if (alGuardar) alGuardar();
    } catch (error) {
      $("#e-error").textContent = mensajeError(error);
    }
  });
}

// Corregir el servicio que nació de una cita ya realizada.
async function corregirServicioDeCita(cita, alGuardar) {
  try {
    const filas = await q(db.from("servicios").select("id").eq("cita_id", cita.id));
    if (!filas.length) { aviso("Esta cita no tiene un servicio asociado.", true); return; }
    editarServicio(filas[0].id, alGuardar);
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

// Cancelar una cita en cualquier momento. Nada se borra: queda registrado quién la canceló,
// cuándo y por qué. Si ya estaba realizada, su servicio pasa a "cancelados" y deja de contar
// (visitas, dinero, reportes y recordatorios). Todo lo hace la función cancelar_cita de la base.
async function cancelarCita(cita, alGuardar) {
  const realizada = cita.estado === "realizada";
  const motivo = await pedirMotivo({
    titulo: realizada ? "Cancelar servicio y su cita" : "Cancelar cita",
    texto: `<strong>${esc(cita.mascota)}</strong> · ${esc(cita.servicio ?? "")} · ${esc(fechaCorta(diaDe(cita.fecha_hora)))} ${esc(horaTexto(cita.fecha_hora))}`,
    aviso: realizada
      ? "Este servicio ya se había realizado. Se cancelan el servicio y su cita: dejan de contar en visitas, dinero, reportes y recordatorios, pero quedan guardados como cancelados."
      : "",
    boton: realizada ? "Sí, cancelar servicio" : "Sí, cancelar cita",
  });
  if (!motivo) return;
  try {
    await q(db.rpc("cancelar_cita", { p_cita_id: cita.id, p_motivo: motivo }));
    aviso(realizada ? "Servicio y cita cancelados. Quedó registrado quién los canceló." : "Cita cancelada. Quedó registrado quién la canceló.");
  } catch (error) {
    // Si otra persona (u otra pestaña) ya la había cancelado, no es un error real.
    if (/ya estaba cancelada|ya fue cancelado/i.test(mensajeError(error))) aviso("Esta cita ya estaba cancelada. Se actualizó la pantalla.");
    else aviso(mensajeError(error), true);
  }
  if (alGuardar) alGuardar(); // siempre se recarga, para mostrar el estado real
}

/* ---------- Pantalla Agenda ---------- */
// Vistas: "dia" (por defecto), "semana" y "buscar" (tabla con filtros sobre las últimas citas).
let vistaAgenda = "dia";
let diaAgenda = null;          // día que se está viendo (AAAA-MM-DD)
let estadoAgenda = "todas";    // filtro rápido: todas, pendiente, realizada, cancelada
const VISTAS_AGENDA = { dia: "Día", semana: "7 días", buscar: "Buscar" };
const ESTADOS_AGENDA = { todas: "Todas", pendiente: "Pendientes", realizada: "Realizadas", cancelada: "Canceladas" };

const precioCita = (c) => (c.estado === "realizada" ? c.precio_cobrado : (c.precio_acordado ?? c.precio));
const lunesDe = (fechaISO) => {
  const d = new Date(fechaISO + "T12:00:00Z").getUTCDay(); // 0 domingo
  return sumarDias(fechaISO, d === 0 ? -6 : 1 - d);
};
const tituloDia = (fechaISO) => {
  const hoy = hoyISO();
  const extra = fechaISO === hoy ? "Hoy · " : fechaISO === sumarDias(hoy, 1) ? "Mañana · " : fechaISO === sumarDias(hoy, -1) ? "Ayer · " : "";
  const t = diaTexto(fechaISO);
  return extra + t.charAt(0).toUpperCase() + t.slice(1);
};

// Quién canceló, cuándo y por qué (se lee de la tabla citas).
async function completarAuditoria(citas) {
  const ids = citas.filter((c) => c.estado === "cancelada").map((c) => c.id);
  if (!ids.length) return;
  try {
    const datos = [];
    for (let i = 0; i < ids.length; i += 200) {
      datos.push(...await q(db.from("citas").select("id,cancelada_por,cancelada_en,motivo_cancelacion").in("id", ids.slice(i, i + 200))));
    }
    const porId = new Map(datos.map((d) => [d.id, d]));
    citas.forEach((c) => Object.assign(c, porId.get(c.id) || {}));
  } catch (error) { /* si aún no existen esas columnas, se muestra solo el estado */ }
}

// Opciones del menú ⋯ de una cita (también se usan en Hoy).
function opcionesCita(c, alGuardar) {
  if (c.estado === "pendiente") return [
    { texto: "Enviar recordatorio por WhatsApp", alHacer: () => abrirRecordatorioCita(c) },
    { texto: "Editar cita", alHacer: () => editarCita(c, alGuardar) },
    { texto: "Ver ficha de la mascota", alHacer: () => abrirFichaEnDialogo(c.mascota_id, alGuardar) },
    { texto: "Cancelar cita", peligro: true, alHacer: () => cancelarCita(c, alGuardar) },
  ];
  if (c.estado === "realizada") return [
    { texto: "Corregir servicio", alHacer: () => corregirServicioDeCita(c, alGuardar) },
    { texto: "Avisar que puede recogerlo", alHacer: () => abrirAvisoRecoger(c) },
    { texto: "Ver ficha de la mascota", alHacer: () => abrirFichaEnDialogo(c.mascota_id, alGuardar) },
    { texto: "Cancelar servicio (y su cita)", peligro: true, alHacer: () => cancelarCita(c, alGuardar) },
  ];
  return [{ texto: "Ver ficha de la mascota", alHacer: () => abrirFichaEnDialogo(c.mascota_id, alGuardar) }];
}

function accionesCita(c) {
  if (c.estado === "pendiente") return `<button class="btn chico" data-terminar="${c.id}">Terminar</button>
    <button class="btn chico alt" data-recordar="${c.id}" title="Enviar recordatorio de la cita por WhatsApp">Recordar</button>${botonMenu(c.id)}`;
  if (c.estado === "realizada") return `<button class="btn chico alt" data-recoger="${c.id}" title="Avisar por WhatsApp que ya puede recogerlo">Avisar</button>${botonMenu(c.id)}`;
  return botonMenu(c.id);
}

// Una cita como renglón compacto: hora | mascota y dueño | servicio | precio | estado | acciones
function htmlCita(c, conFecha = false) {
  const clase = { pendiente: "", realizada: "ok", cancelada: "gris" }[c.estado] ?? "";
  const precio = c.estado === "cancelada"
    ? `<s>${dinero(c.precio_cobrado ?? c.precio_acordado ?? c.precio)}</s>`
    : dinero(precioCita(c));
  const [hora, ampm] = horaTexto(c.fecha_hora).split(/\s(?=[ap]\.)/);
  return `<article class="cita estado-${esc(c.estado)}">
    <div class="cita-hora">${conFecha ? `<small>${esc(fechaCorta(diaDe(c.fecha_hora)))}</small>` : ""}<strong>${esc(hora)}</strong><small>${esc(ampm ?? "")}</small></div>
    <div class="cita-quien">
      <button class="enlace" data-ficha="${c.mascota_id}" title="Ver ficha e historial">${esc(c.mascota)}</button>
      <div class="suave">${esc(c.cliente)}${c.telefono ? ` · ${esc(c.telefono)}` : ""}</div>
    </div>
    <div class="cita-servicio">${esc(c.servicio ?? "—")}${c.medicado ? ' <span class="etiqueta">medicado</span>' : ""}
      ${c.guia ? `<div class="suave">guía ${esc(c.guia)}</div>` : ""}${c.motivo ? `<div class="suave">${esc(c.motivo)}</div>` : ""}</div>
    <div class="cita-precio">${precio}</div>
    <div class="cita-estado"><span class="etiqueta ${clase}">${esc(c.estado)}</span>
      ${c.estado === "cancelada" ? htmlAuditoria(c.cancelada_por, c.cancelada_en, c.motivo_cancelacion) : ""}</div>
    <div class="acciones-tabla">${accionesCita(c)}</div>
  </article>`;
}

// Resumen del rango: cuántas citas hay en cada estado y cuánta plata.
function htmlResumenAgenda(citas) {
  const n = (e) => citas.filter((c) => c.estado === e).length;
  const cobrado = citas.filter((c) => c.estado === "realizada").reduce((s, c) => s + (Number(c.precio_cobrado) || 0), 0);
  const porCobrar = citas.filter((c) => c.estado === "pendiente").reduce((s, c) => s + (Number(c.precio_acordado ?? c.precio) || 0), 0);
  const pl = (k, uno, varios) => `<b>${k}</b> ${k === 1 ? uno : varios}`;
  return `<div class="resumen-agenda">
    <span>${pl(citas.length - n("cancelada"), "cita", "citas")}</span>
    <span>${pl(n("pendiente"), "pendiente", "pendientes")}</span>
    <span>${pl(n("realizada"), "realizada", "realizadas")}</span>
    ${n("cancelada") ? `<span class="suave">${pl(n("cancelada"), "cancelada", "canceladas")}</span>` : ""}
    <span>Cobrado <b>${dinero(cobrado)}</b></span>
    ${porCobrar ? `<span>Por cobrar <b>${dinero(porCobrar)}</b></span>` : ""}
  </div>`;
}

// Lista de un día: activas primero (por hora) y las canceladas recogidas al final.
function htmlListaDia(citas, dia, mostrarVacio = true) {
  const visibles = estadoAgenda === "todas" ? citas : citas.filter((c) => c.estado === estadoAgenda);
  const activas = visibles.filter((c) => c.estado !== "cancelada");
  const canceladas = visibles.filter((c) => c.estado === "cancelada");
  if (!visibles.length) {
    return mostrarVacio ? `<div class="vacio-dia"><p class="suave">${citas.length ? "Ninguna cita con ese estado." : "No hay citas este día."}</p></div>` : "";
  }
  let h = activas.map((c) => htmlCita(c)).join("");
  if (canceladas.length) {
    h += estadoAgenda === "cancelada"
      ? canceladas.map((c) => htmlCita(c)).join("")
      : `<details class="canceladas-dia"><summary>${canceladas.length} ${canceladas.length === 1 ? "cancelada" : "canceladas"}</summary>${canceladas.map((c) => htmlCita(c)).join("")}</details>`;
  }
  return h;
}

function conectarCitas(caja, citas) {
  const buscar = (b, atributo) => citas.find((c) => c.id === Number(b.dataset[atributo]));
  $$("[data-ficha]", caja).forEach((b) => b.addEventListener("click", () => abrirFichaEnDialogo(Number(b.dataset.ficha), cargarAgenda)));
  $$("[data-terminar]", caja).forEach((b) => b.addEventListener("click", () => abrirTerminarCita(buscar(b, "terminar"), cargarAgenda)));
  $$("[data-recoger]", caja).forEach((b) => b.addEventListener("click", () => abrirAvisoRecoger(buscar(b, "recoger"))));
  $$("[data-recordar]", caja).forEach((b) => b.addEventListener("click", () => abrirRecordatorioCita(buscar(b, "recordar"))));
  $$("[data-menu]", caja).forEach((b) => b.addEventListener("click", () => abrirMenu(b, opcionesCita(buscar(b, "menu"), cargarAgenda))));
  $$("[data-agendar-dia]", caja).forEach((b) => b.addEventListener("click", () => {
    estado.agendarPrefill = { dia: b.dataset.agendarDia };
    location.hash = "#/agendar";
  }));
}

async function traerCitas(desde, hastaExclusivo) {
  const citas = await q(db.from("agenda").select("*")
    .gte("fecha_hora", inicioDiaBogota(desde)).lt("fecha_hora", inicioDiaBogota(hastaExclusivo))
    .order("fecha_hora", { ascending: true }));
  await completarAuditoria(citas);
  return citas;
}

async function cargarAgenda() {
  const caja = $("#lista-agenda");
  if (!caja) return;
  const pintarCabecera = (texto) => { const t = $("#agenda-titulo"); if (t) t.textContent = texto; };
  try {
    if (vistaAgenda === "dia") {
      pintarCabecera(tituloDia(diaAgenda));
      const citas = await traerCitas(diaAgenda, sumarDias(diaAgenda, 1));
      if (!$("#lista-agenda")) return;
      caja.innerHTML = htmlResumenAgenda(citas) + `<div class="lista-citas">${htmlListaDia(citas, diaAgenda)}</div>`;
      conectarCitas(caja, citas);
    } else if (vistaAgenda === "semana") {
      const lunes = diaAgenda; // 7 días desde el día elegido (con "Hoy": hoy y los 6 siguientes)
      pintarCabecera(`Del ${fechaCorta(lunes)} al ${fechaCorta(sumarDias(lunes, 6))}`);
      const citas = await traerCitas(lunes, sumarDias(lunes, 7));
      if (!$("#lista-agenda")) return;
      let h = htmlResumenAgenda(citas);
      for (let i = 0; i < 7; i++) {
        const dia = sumarDias(lunes, i);
        const delDia = citas.filter((c) => diaDe(c.fecha_hora) === dia);
        const activas = delDia.filter((c) => c.estado !== "cancelada").length;
        h += `<section class="dia-semana${dia === hoyISO() ? " es-hoy" : ""}">
          <h3><button type="button" class="enlace-dia" data-ir-dia="${dia}" title="Ver este día">${esc(tituloDia(dia))}</button>
            <span class="suave">${activas ? `${activas} ${activas === 1 ? "cita" : "citas"}` : "sin citas"}</span></h3>
          <div class="lista-citas">${htmlListaDia(delDia, dia, false)}</div></section>`;
      }
      caja.innerHTML = h;
      conectarCitas(caja, citas);
      $$("[data-ir-dia]", caja).forEach((b) => b.addEventListener("click", () => {
        diaAgenda = b.dataset.irDia; vistaAgenda = "dia"; montarPantalla("agenda");
      }));
    } else {
      pintarCabecera("Buscar en todas las citas");
      // Trae todas las citas (de a 1.000 por vez), no solo las últimas.
      const citas = await traerTodo(() => db.from("agenda").select("*").order("fecha_hora", { ascending: false }).order("id"));
      await completarAuditoria(citas);
      if (!$("#lista-agenda")) return;
      tablaInteractiva(caja, {
        id: "agenda",
        filas: citas,
        fila: filaCitaTabla,
        vacio: "Ninguna cita coincide con los filtros.",
        columnas: [
          { titulo: "Fecha y hora", valor: (c) => c.fecha_hora, dia: (c) => diaDe(c.fecha_hora), filtro: "fecha" },
          { titulo: "Mascota", valor: (c) => c.mascota, filtro: "texto" },
          { titulo: "Dueño", valor: (c) => c.cliente, texto: (c) => [c.cliente, c.telefono, c.telefono2].join(" "), filtro: "texto" },
          { titulo: "Servicio", valor: (c) => c.servicio ?? "", filtro: "lista" },
          { titulo: "Precio", valor: (c) => precioCita(c) === null || precioCita(c) === undefined ? null : Number(precioCita(c)), filtro: false, clase: "num" },
          { titulo: "Estado", valor: (c) => c.estado, filtro: "lista" },
          { titulo: "", valor: () => "", ordenable: false, filtro: false },
        ],
        alPintar: (tbody) => conectarCitas(tbody, citas),
      });
    }
  } catch (error) {
    mostrarError(caja, error);
  }
}

function filaCitaTabla(c) {
  const clase = { pendiente: "", realizada: "ok", cancelada: "gris" }[c.estado] ?? "";
  return `<tr${c.estado === "cancelada" ? ' class="cancelada"' : ""}>
    <td>${htmlFechaHora(c.fecha_hora)}</td>
    <td><button class="enlace" data-ficha="${c.mascota_id}" title="Ver ficha e historial">${esc(c.mascota)}</button></td>
    <td>${esc(c.cliente)}<div class="suave">${esc([c.telefono, c.telefono2].filter(Boolean).join(" / "))}</div></td>
    <td>${esc(c.servicio ?? "—")}${c.medicado ? ' <span class="etiqueta">medicado</span>' : ""}${c.guia ? `<div class="suave">guía ${esc(c.guia)}</div>` : ""}</td>
    <td class="num">${c.estado === "cancelada" ? `<s>${dinero(c.precio_cobrado ?? c.precio_acordado ?? c.precio)}</s>` : dinero(precioCita(c))}</td>
    <td><span class="etiqueta ${clase}">${esc(c.estado)}</span>${c.estado === "cancelada" ? htmlAuditoria(c.cancelada_por, c.cancelada_en, c.motivo_cancelacion) : ""}</td>
    <td><div class="acciones-tabla">${accionesCita(c)}</div></td>
  </tr>`;
}

// Texto del centro: "Hoy", "Mañana", "Ayer" o la fecha del día que se está viendo.
function etiquetaDiaAgenda() {
  const hoy = hoyISO();
  if (vistaAgenda === "semana") return diaAgenda === hoy ? "Desde hoy" : `Desde ${fechaCorta(diaAgenda).slice(0, 5)}`;
  if (diaAgenda === hoy) return "Hoy";
  if (diaAgenda === sumarDias(hoy, 1)) return "Mañana";
  if (diaAgenda === sumarDias(hoy, -1)) return "Ayer";
  return `${diaSemanaCorto(diaAgenda)} ${fechaCorta(diaAgenda).slice(0, 5)}`;
}

PANTALLAS.agenda = {
  html: () => {
    if (!diaAgenda) diaAgenda = hoyISO();
    const paso = vistaAgenda === "semana" ? 7 : 1;
    return `<div class="agenda-cabecera">
      <h1>Agenda</h1>
      <div class="segmentado" role="tablist" aria-label="Vista">${Object.entries(VISTAS_AGENDA).map(([clave, texto]) =>
        `<button type="button" role="tab" aria-selected="${clave === vistaAgenda}" data-vista="${clave}">${texto}</button>`).join("")}</div>
    </div>
    <div class="tarjeta">
      ${vistaAgenda === "buscar" ? `<p class="suave">Todas las citas. Filtra por fecha, mascota, dueño, servicio o estado, y ordena con los encabezados.</p>` : `
      <div class="navegador-fecha">
        <div class="nav-flechas">
          <button type="button" class="btn chico alt solo-icono" data-mover="-${paso}" aria-label="${paso === 7 ? "7 días antes" : "Día anterior"}">‹</button>
          <span class="dia-actual" aria-live="polite">${esc(etiquetaDiaAgenda())}</span>
          <button type="button" class="btn chico alt solo-icono" data-mover="${paso}" aria-label="${paso === 7 ? "7 días después" : "Día siguiente"}">›</button>
          ${diaAgenda !== hoyISO() ? '<button type="button" class="btn chico alt" data-mover="hoy">Volver a hoy</button>' : ""}
        </div>
        <h2 id="agenda-titulo" class="titulo-fecha"></h2>
        <input type="date" id="agenda-fecha" value="${diaAgenda}" aria-label="Ir a una fecha">
      </div>
      <div class="filtros estados-agenda">${Object.entries(ESTADOS_AGENDA).map(([clave, texto]) =>
        `<button type="button" class="chip" data-estado-agenda="${clave}" aria-pressed="${clave === estadoAgenda}">${texto}</button>`).join("")}</div>`}
      <div id="lista-agenda"><p class="suave">Cargando…</p></div>
    </div>`;
  },
  despues: async () => {
    $$("[data-vista]").forEach((b) => b.addEventListener("click", () => { vistaAgenda = b.dataset.vista; montarPantalla("agenda"); }));
    $$("[data-mover]").forEach((b) => b.addEventListener("click", () => {
      diaAgenda = b.dataset.mover === "hoy" ? hoyISO() : sumarDias(diaAgenda, Number(b.dataset.mover));
      montarPantalla("agenda");
    }));
    const fecha = $("#agenda-fecha");
    if (fecha) fecha.addEventListener("change", () => { if (fecha.value) { diaAgenda = fecha.value; montarPantalla("agenda"); } });
    $$("[data-estado-agenda]").forEach((b) => b.addEventListener("click", () => {
      estadoAgenda = b.dataset.estadoAgenda;
      $$("[data-estado-agenda]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      cargarAgenda();
    }));
    await cargarAgenda();
  },
};
