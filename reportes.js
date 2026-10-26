"use strict";

/* =====================================================================
   REPORTES: resumen por fechas en pantalla y descarga de Excel con
   historial, mascotas, dueños, citas, totales por servicio y por mes.
   La librería de Excel (SheetJS) se descarga solo al pedir el archivo.
   ===================================================================== */

const URL_EXCEL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
const FORMATO_DINERO = '"$"#,##0';
const FORMATO_FECHA = "dd/mm/yyyy";

const RANGOS = {
  mes: "Este mes",
  pasado: "Mes pasado",
  tres: "Últimos 3 meses",
  anio: "Este año",
  todo: "Todo",
};
let rangoReporte = "mes";
let fechasReporte = null; // { desde, hasta } elegidas (se recuerdan al volver a la pantalla)
let datosReporte = null; // lo último que se calculó (para el Excel)

function fechasDeRango(clave) {
  const hoy = hoyISO();
  const [a, m] = hoy.split("-").map(Number);
  const inicioMes = (anio, mes) => new Date(Date.UTC(anio, mes - 1, 1)).toISOString().slice(0, 10);
  if (clave === "mes") return { desde: inicioMes(a, m), hasta: hoy };
  if (clave === "pasado") return { desde: inicioMes(a, m - 1), hasta: sumarDias(inicioMes(a, m), -1) };
  if (clave === "tres") return { desde: inicioMes(a, m - 2), hasta: hoy };
  if (clave === "anio") return { desde: `${a}-01-01`, hasta: hoy };
  return { desde: "", hasta: "" };
}

const nombreMes = (aaaamm) => {
  const [a, m] = aaaamm.split("-").map(Number);
  const texto = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};
const numero = (n) => Number(n) || 0;
const textoRango = (d, h) => (d || h) ? `${d ? fechaTexto(d) : "el inicio"} a ${h ? fechaTexto(h) : "hoy"}` : "Todo el historial";

/* ---------- Traer y calcular ---------- */
async function calcularReporte(desde, hasta) {
  const [historial, mascotas, clientes, citas] = await Promise.all([
    traerTodo(() => {
      let c = db.from("historial").select("*").order("fecha", { ascending: false }).order("id", { ascending: false });
      if (desde) c = c.gte("fecha", desde);
      if (hasta) c = c.lte("fecha", hasta);
      return c;
    }),
    traerTodo(() => db.from("mascotas_resumen").select("*").order("mascota").order("mascota_id")),
    traerTodo(() => db.from("clientes").select("id,nombre,telefono,telefono2,notas,activo").order("nombre").order("id")),
    traerTodo(() => {
      let c = db.from("agenda").select("*").order("fecha_hora", { ascending: false }).order("id", { ascending: false });
      if (desde) c = c.gte("fecha_hora", inicioDiaBogota(desde));
      if (hasta) c = c.lt("fecha_hora", inicioDiaBogota(sumarDias(hasta, 1)));
      return c;
    }),
  ]);

  // Bitácora de cancelaciones (si las tablas/columnas aún no existen, se deja vacío)
  let anulados = [];
  try {
    anulados = await traerTodo(() => {
      let c = db.from("servicios_anulados").select("*").order("anulado_en", { ascending: false }).order("id");
      if (desde) c = c.gte("anulado_en", inicioDiaBogota(desde));
      if (hasta) c = c.lt("anulado_en", inicioDiaBogota(sumarDias(hasta, 1)));
      return c;
    });
  } catch (error) { anulados = []; }
  const idsCanceladas = citas.filter((c) => c.estado === "cancelada").map((c) => c.id);
  if (idsCanceladas.length) {
    try {
      const datos = [];
      for (let i = 0; i < idsCanceladas.length; i += 200) {
        datos.push(...await q(db.from("citas").select("id,cancelada_por,cancelada_en,motivo_cancelacion").in("id", idsCanceladas.slice(i, i + 200))));
      }
      const porId = new Map(datos.map((d) => [d.id, d]));
      citas.forEach((c) => Object.assign(c, porId.get(c.id) || {}));
    } catch (error) { /* sin auditoría */ }
  }

  const mascotaPorId = new Map(mascotas.map((m) => [m.mascota_id, m]));
  const filasAnulados = anulados.map((a) => {
    const m = mascotaPorId.get(a.mascota_id) || {};
    return { ...a, mascota: m.mascota ?? "", cliente: m.cliente ?? "", precio: numero(a.precio_cobrado) };
  });
  const filasHist = historial.map((f) => {
    const m = mascotaPorId.get(f.mascota_id) || {};
    return {
      fecha: f.fecha, mascota: f.mascota ?? m.mascota ?? "", mascota_id: f.mascota_id,
      cliente_id: f.cliente_id ?? m.cliente_id, especie: m.especie ?? "", raza: m.raza ?? "",
      cliente: m.cliente ?? "", telefono: m.telefono ?? "", servicio: f.servicio ?? "",
      medicado: !!f.medicado, recargo: f.recargo_medicado ?? null, guia: f.guia ?? "",
      precio: numero(f.precio_cobrado), notas: f.notas ?? "",
    };
  });

  // Totales por mascota y por dueño (en el período elegido)
  const porMascota = new Map(), porCliente = new Map();
  for (const f of filasHist) {
    const pm = porMascota.get(f.mascota_id) || { servicios: 0, total: 0, ultima: "" };
    pm.servicios++; pm.total += f.precio; if (f.fecha > pm.ultima) pm.ultima = f.fecha;
    porMascota.set(f.mascota_id, pm);
    const pc = porCliente.get(f.cliente_id) || { servicios: 0, total: 0 };
    pc.servicios++; pc.total += f.precio;
    porCliente.set(f.cliente_id, pc);
  }
  const filasMascotas = mascotas.map((m) => {
    const t = porMascota.get(m.mascota_id) || { servicios: 0, total: 0 };
    return { ...m, servicios_periodo: t.servicios, total_periodo: t.total };
  }).sort((a, b) => b.total_periodo - a.total_periodo || comparar(a.mascota, b.mascota));

  const mascotasDeCliente = new Map();
  for (const m of mascotas) {
    if (!mascotasDeCliente.has(m.cliente_id)) mascotasDeCliente.set(m.cliente_id, []);
    mascotasDeCliente.get(m.cliente_id).push(m.mascota);
  }
  const filasClientes = clientes.map((c) => {
    const t = porCliente.get(c.id) || { servicios: 0, total: 0 };
    const nombres = mascotasDeCliente.get(c.id) || [];
    return { ...c, num_mascotas: nombres.length, mascotas: nombres.join(", "), servicios_periodo: t.servicios, total_periodo: t.total };
  }).sort((a, b) => b.total_periodo - a.total_periodo || comparar(a.nombre, b.nombre));

  const agrupar = (clave) => {
    const mapa = new Map();
    for (const f of filasHist) {
      const k = clave(f);
      const g = mapa.get(k) || { nombre: k, cantidad: 0, total: 0 };
      g.cantidad++; g.total += f.precio;
      mapa.set(k, g);
    }
    return [...mapa.values()];
  };
  const porServicio = agrupar((f) => f.servicio || "(sin servicio)").sort((a, b) => b.total - a.total);
  const porMes = agrupar((f) => (f.fecha || "").slice(0, 7)).sort((a, b) => comparar(a.nombre, b.nombre))
    .map((g) => ({ ...g, nombre: g.nombre ? nombreMes(g.nombre) : "(sin fecha)" }));

  const ingresos = filasHist.reduce((s, f) => s + f.precio, 0);
  const resumen = {
    ingresos,
    servicios: filasHist.length,
    promedio: filasHist.length ? Math.round(ingresos / filasHist.length) : 0,
    medicados: filasHist.filter((f) => f.medicado).length,
    mascotasAtendidas: porMascota.size,
    clientesAtendidos: porCliente.size,
    mascotasRegistradas: mascotas.length,
    clientesRegistrados: clientes.length,
    clientesActivos: clientes.filter((c) => c.activo !== false).length,
    citas: citas.length,
    citasRealizadas: citas.filter((c) => c.estado === "realizada").length,
    citasPendientes: citas.filter((c) => c.estado === "pendiente").length,
    citasCanceladas: citas.filter((c) => c.estado === "cancelada").length,
    anulados: filasAnulados.length,
    dineroAnulado: filasAnulados.reduce((s, a) => s + a.precio, 0),
  };
  return { desde, hasta, resumen, filasHist, filasMascotas, filasClientes, citas, porServicio, porMes, filasAnulados };
}

/* ---------- Pantalla ---------- */
function htmlTablaSimple(titulo, grupos) {
  const total = grupos.reduce((s, g) => s + g.total, 0), cant = grupos.reduce((s, g) => s + g.cantidad, 0);
  return `<div class="tarjeta"><h2>${esc(titulo)}</h2>${grupos.length ? `<div class="tabla-scroll"><table>
    <thead><tr><th></th><th class="num">Cantidad</th><th class="num">Total</th></tr></thead>
    <tbody>${grupos.map((g) => `<tr><td>${esc(g.nombre)}</td><td class="num">${g.cantidad}</td><td class="num">${dinero(g.total)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><th>Total</th><th class="num">${cant}</th><th class="num">${dinero(total)}</th></tr></tfoot></table></div>`
    : '<p class="suave">Sin servicios en este período.</p>'}</div>`;
}

function pintarReporte(d) {
  const r = d.resumen;
  $("#rep-resultado").innerHTML = `
    <p class="suave">Período: <strong>${esc(textoRango(d.desde, d.hasta))}</strong></p>
    <div class="stats stats-4">
      <div class="stat"><b>${dinero(r.ingresos)}</b>Ingresos por servicios</div>
      <div class="stat"><b>${r.servicios}</b>Servicios realizados</div>
      <div class="stat"><b>${dinero(r.promedio)}</b>Valor promedio por servicio</div>
      <div class="stat"><b>${r.mascotasAtendidas}</b>Mascotas atendidas</div>
      <div class="stat"><b>${r.clientesAtendidos}</b>Clientes atendidos</div>
      <div class="stat"><b>${r.medicados}</b>Baños medicados</div>
      <div class="stat"><b>${r.mascotasRegistradas}</b>Mascotas registradas (total)</div>
      <div class="stat"><b>${r.clientesRegistrados}</b>Clientes registrados (${r.clientesActivos} activos)</div>
    </div>
    <p class="suave">Citas del período: ${r.citas} · ${r.citasRealizadas} realizadas · ${r.citasPendientes} pendientes · ${r.citasCanceladas} canceladas</p>
    ${r.anulados ? `<p class="aviso-fijo">⚠ ${r.anulados} ${r.anulados === 1 ? "servicio realizado fue cancelado" : "servicios realizados fueron cancelados"} en este período (${dinero(r.dineroAnulado)} que ya no cuentan). Mira el detalle abajo y en la hoja "Cancelados" del Excel.</p>` : ""}
    <div class="columnas">${htmlTablaSimple("Por servicio", d.porServicio)}${htmlTablaSimple("Por mes", d.porMes)}</div>
    <div class="tarjeta"><h2>Dueños</h2><p class="suave">Suma de lo que se le cobró a todas sus mascotas en el período.</p><div id="rep-clientes"></div></div>
    ${d.filasAnulados.length ? `<div class="tarjeta"><h2>Servicios cancelados</h2><p class="suave">Quién canceló cada servicio realizado, cuándo y por qué.</p><div id="rep-anulados"></div></div>` : ""}
    <div class="tarjeta"><h2>Mascotas</h2><p class="suave">Todas las mascotas registradas, con lo cobrado en el período.</p><div id="rep-mascotas"></div></div>`;

  tablaInteractiva($("#rep-clientes"), {
    id: "rep-clientes",
    filas: d.filasClientes,
    columnas: [
      { titulo: "Dueño", valor: (c) => c.nombre, filtro: "texto" },
      { titulo: "Teléfonos", valor: (c) => c.telefono, texto: (c) => [c.telefono, c.telefono2].join(" "), filtro: "texto" },
      { titulo: "Mascotas", valor: (c) => c.num_mascotas, texto: (c) => c.mascotas, filtro: "texto" },
      { titulo: "Servicios", valor: (c) => c.servicios_periodo, filtro: false, clase: "num" },
      { titulo: "Total", valor: (c) => c.total_periodo, filtro: false, clase: "num" },
    ],
    fila: (c) => `<tr><td>${esc(c.nombre)}${c.activo === false ? ' <span class="suave">· inactivo</span>' : ""}</td>
      <td>${esc([c.telefono, c.telefono2].filter(Boolean).join(" / "))}</td>
      <td>${c.num_mascotas}<div class="suave">${esc(c.mascotas)}</div></td>
      <td class="num">${c.servicios_periodo}</td><td class="num"><strong>${dinero(c.total_periodo)}</strong></td></tr>`,
  });
  if (d.filasAnulados.length) tablaInteractiva($("#rep-anulados"), {
    id: "rep-anulados",
    filas: d.filasAnulados,
    columnas: [
      { titulo: "Cancelado el", valor: (a) => a.anulado_en, dia: (a) => diaDe(a.anulado_en), filtro: "fecha" },
      { titulo: "Por", valor: (a) => a.anulado_por, filtro: "lista" },
      { titulo: "Mascota", valor: (a) => a.mascota, filtro: "texto" },
      { titulo: "Servicio", valor: (a) => a.servicio ?? "", filtro: "lista" },
      { titulo: "Fecha del servicio", valor: (a) => a.fecha ?? "", filtro: false },
      { titulo: "Valor", valor: (a) => a.precio, filtro: false, clase: "num" },
      { titulo: "Motivo", valor: (a) => a.motivo, filtro: "texto" },
    ],
    fila: (a) => `<tr><td>${htmlFechaHora(a.anulado_en)}</td><td>${esc(a.anulado_por)}</td><td>${esc(a.mascota)}<div class="suave">${esc(a.cliente)}</div></td>
      <td>${esc(a.servicio ?? "")}</td><td>${esc(fechaCorta(a.fecha))}</td><td class="num"><s>${dinero(a.precio)}</s></td><td>${esc(a.motivo)}</td></tr>`,
  });
  tablaInteractiva($("#rep-mascotas"), {
    id: "rep-mascotas",
    filas: d.filasMascotas,
    columnas: [
      { titulo: "Mascota", valor: (m) => m.mascota, filtro: "texto" },
      { titulo: "Especie", valor: (m) => m.especie, filtro: "lista" },
      { titulo: "Raza", valor: (m) => m.raza ?? "", filtro: "lista" },
      { titulo: "Dueño", valor: (m) => m.cliente, filtro: "texto" },
      { titulo: "Última visita", valor: (m) => m.ultima_visita ?? "", filtro: "fecha" },
      { titulo: "Servicios", valor: (m) => m.servicios_periodo, filtro: false, clase: "num" },
      { titulo: "Total", valor: (m) => m.total_periodo, filtro: false, clase: "num" },
    ],
    fila: (m) => `<tr><td>${esc(m.mascota)}</td><td>${esc(m.especie)}</td><td>${esc(m.raza ?? "—")}</td>
      <td>${esc(m.cliente)}</td><td>${esc(fechaCorta(m.ultima_visita))}</td>
      <td class="num">${m.servicios_periodo}</td><td class="num"><strong>${dinero(m.total_periodo)}</strong></td></tr>`,
  });
}

async function cargarReporte() {
  const caja = $("#rep-resultado");
  if (!caja) return;
  const desde = $("#rep-desde").value, hasta = $("#rep-hasta").value;
  fechasReporte = { desde, hasta };
  if (desde && hasta && desde > hasta) {
    caja.innerHTML = '<p class="mal">✖ La fecha "desde" no puede ser posterior a la fecha "hasta".</p>';
    return;
  }
  caja.innerHTML = '<p class="suave">Calculando…</p>';
  $("#rep-excel").disabled = true;
  try {
    const d = await calcularReporte(desde, hasta);
    if (!$("#rep-resultado")) return;
    datosReporte = d;
    pintarReporte(d);
    $("#rep-excel").disabled = false;
  } catch (error) {
    mostrarError(caja, error);
  }
}

/* ---------- Excel ---------- */
const aFecha = (iso) => {
  if (!iso) return null;
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
};

// Crea una hoja con encabezados, formato de dinero/fecha, filtros y una fila de totales.
function hojaExcel(encabezados, filas, { dinero: colsDinero = [], fecha: colsFecha = [], anchos = [], totales = null } = {}) {
  const XLSX = window.XLSX;
  const datos = [encabezados, ...filas];
  const hoja = XLSX.utils.aoa_to_sheet(datos, { cellDates: true });
  const ultimaFila = filas.length + 1; // número de fila en Excel (con encabezado)
  for (let r = 1; r <= filas.length; r++) {
    colsDinero.forEach((c) => { const cel = hoja[XLSX.utils.encode_cell({ r, c })]; if (cel && cel.t === "n") cel.z = FORMATO_DINERO; });
    colsFecha.forEach((c) => { const cel = hoja[XLSX.utils.encode_cell({ r, c })]; if (cel) cel.z = FORMATO_FECHA; });
  }
  if (filas.length) hoja["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: encabezados.length - 1 } }) };
  if (totales && filas.length) {
    const r = filas.length + 1;
    XLSX.utils.sheet_add_aoa(hoja, [[totales.etiqueta]], { origin: { r, c: 0 } });
    (totales.sumar || []).forEach((c) => {
      const letra = XLSX.utils.encode_col(c);
      const valor = filas.reduce((s, f) => s + (Number(f[c]) || 0), 0);
      hoja[XLSX.utils.encode_cell({ r, c })] = {
        t: "n", v: valor, f: `SUM(${letra}2:${letra}${ultimaFila})`, z: colsDinero.includes(c) ? FORMATO_DINERO : "0",
      };
    });
    hoja["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: encabezados.length - 1 } });
  }
  hoja["!cols"] = encabezados.map((e, i) => ({ wch: anchos[i] || Math.max(10, String(e).length + 2) }));
  return hoja;
}

async function descargarExcel() {
  const d = datosReporte;
  if (!d) return;
  const boton = $("#rep-excel");
  boton.disabled = true;
  boton.textContent = "Preparando Excel…";
  try {
    await cargarScript(URL_EXCEL);
    const XLSX = window.XLSX;
    const libro = XLSX.utils.book_new();
    const r = d.resumen;
    const siNo = (b) => (b ? "Sí" : "No");

    const resumen = XLSX.utils.aoa_to_sheet([
      [`Reporte de ${nombreNegocio()}`],
      ["Período", textoRango(d.desde, d.hasta)],
      ["Generado", new Date().toLocaleString("es-CO", { timeZone: ZONA })],
      [],
      ["Indicador", "Valor"],
      ["Ingresos por servicios", r.ingresos],
      ["Servicios realizados", r.servicios],
      ["Valor promedio por servicio", r.promedio],
      ["Baños medicados", r.medicados],
      ["Mascotas atendidas en el período", r.mascotasAtendidas],
      ["Clientes atendidos en el período", r.clientesAtendidos],
      ["Mascotas registradas (total)", r.mascotasRegistradas],
      ["Clientes registrados (total)", r.clientesRegistrados],
      ["Clientes activos", r.clientesActivos],
      ["Citas del período", r.citas],
      ["Citas realizadas", r.citasRealizadas],
      ["Citas pendientes", r.citasPendientes],
      ["Citas canceladas", r.citasCanceladas],
      ["Servicios realizados que se cancelaron", r.anulados],
      ["Dinero de servicios cancelados (no cuenta)", r.dineroAnulado],
    ]);
    ["B6", "B8", "B20"].forEach((ref) => { if (resumen[ref]) resumen[ref].z = FORMATO_DINERO; });
    resumen["!cols"] = [{ wch: 34 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(libro, resumen, "Resumen");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Fecha", "Mascota", "Especie", "Raza", "Dueño", "Teléfono", "Servicio", "Medicado", "Recargo medicado", "Guía", "Precio cobrado", "Notas"],
      d.filasHist.map((f) => [aFecha(f.fecha), f.mascota, f.especie, f.raza, f.cliente, f.telefono, f.servicio,
        siNo(f.medicado), f.recargo === null ? null : numero(f.recargo), f.guia, f.precio, f.notas]),
      { dinero: [8, 10], fecha: [0], anchos: [12, 16, 9, 16, 22, 14, 16, 10, 12, 8, 14, 30],
        totales: { etiqueta: `Total (${d.filasHist.length} servicios)`, sumar: [8, 10] } },
    ), "Historial");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Mascota", "Especie", "Raza", "Dueño", "Teléfono", "Teléfono 2", "Cliente activo", "Descripción del corte", "Visitas (total)", "Última visita", "Servicios en el período", "Total en el período"],
      d.filasMascotas.map((m) => [m.mascota, m.especie, m.raza ?? "", m.cliente, m.telefono ?? "", m.telefono2 ?? "",
        siNo(m.activo !== false), m.descripcion_corte ?? "", numero(m.visitas), aFecha(m.ultima_visita), m.servicios_periodo, m.total_periodo]),
      { dinero: [11], fecha: [9], anchos: [16, 9, 16, 22, 14, 14, 10, 30, 10, 12, 12, 14],
        totales: { etiqueta: `Total (${d.filasMascotas.length} mascotas)`, sumar: [10, 11] } },
    ), "Mascotas");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Dueño", "Teléfono", "Teléfono 2", "Activo", "Cantidad de mascotas", "Mascotas", "Servicios en el período", "Total en el período", "Notas"],
      d.filasClientes.map((c) => [c.nombre, c.telefono ?? "", c.telefono2 ?? "", siNo(c.activo !== false),
        c.num_mascotas, c.mascotas, c.servicios_periodo, c.total_periodo, c.notas ?? ""]),
      { dinero: [7], anchos: [22, 14, 14, 8, 10, 30, 12, 14, 30],
        totales: { etiqueta: `Total (${d.filasClientes.length} dueños)`, sumar: [4, 6, 7] } },
    ), "Dueños");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Fecha", "Hora", "Mascota", "Dueño", "Teléfono", "Servicio", "Medicado", "Estado", "Precio acordado", "Precio cobrado", "Motivo", "Cancelada por", "Cancelada el", "Motivo de cancelación"],
      d.citas.map((c) => [aFecha(diaDe(c.fecha_hora)), horaTexto(c.fecha_hora), c.mascota, c.cliente, c.telefono ?? "",
        c.servicio ?? "", siNo(c.medicado), c.estado,
        c.precio_acordado === null || c.precio_acordado === undefined ? null : numero(c.precio_acordado),
        c.precio_cobrado === null || c.precio_cobrado === undefined || c.estado === "cancelada" ? null : numero(c.precio_cobrado), c.motivo ?? "",
        c.cancelada_por ?? "", c.cancelada_en ? `${fechaCorta(diaDe(c.cancelada_en))} ${horaTexto(c.cancelada_en)}` : "", c.motivo_cancelacion ?? ""]),
      { dinero: [8, 9], fecha: [0], anchos: [12, 10, 16, 22, 14, 16, 10, 11, 14, 14, 24, 16, 18, 30],
        totales: { etiqueta: `Total (${d.citas.length} citas)`, sumar: [9] } },
    ), "Citas");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Cancelado el", "Cancelado por", "Mascota", "Dueño", "Servicio", "Fecha del servicio", "Valor (no cuenta)", "Motivo"],
      d.filasAnulados.map((a) => [`${fechaCorta(diaDe(a.anulado_en))} ${horaTexto(a.anulado_en)}`, a.anulado_por, a.mascota, a.cliente,
        a.servicio ?? "", aFecha(a.fecha), a.precio, a.motivo]),
      { dinero: [6], fecha: [5], anchos: [20, 16, 16, 22, 16, 14, 14, 36],
        totales: { etiqueta: `Total (${d.filasAnulados.length} cancelados)`, sumar: [6] } },
    ), "Cancelados");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Servicio", "Cantidad", "Total"], d.porServicio.map((g) => [g.nombre, g.cantidad, g.total]),
      { dinero: [2], anchos: [22, 10, 14], totales: { etiqueta: "Total", sumar: [1, 2] } },
    ), "Por servicio");

    XLSX.utils.book_append_sheet(libro, hojaExcel(
      ["Mes", "Cantidad", "Total"], d.porMes.map((g) => [g.nombre, g.cantidad, g.total]),
      { dinero: [2], anchos: [20, 10, 14], totales: { etiqueta: "Total", sumar: [1, 2] } },
    ), "Por mes");

    const negocio = nombreSeguroArchivo(nombreNegocio());
    const periodo = d.desde || d.hasta ? `${d.desde || "inicio"}_a_${d.hasta || hoyISO()}` : "todo";
    XLSX.writeFile(libro, `${negocio}-reporte-${periodo}.xlsx`, { compression: true });
    aviso("Excel descargado.");
  } catch (error) {
    aviso(mensajeError(error), true);
  } finally {
    boton.disabled = false;
    boton.textContent = "⬇ Descargar Excel";
  }
}

/* ---------- Respaldo completo ----------
   Descarga TODAS las tablas tal cual están en la base (una hoja por tabla), para guardar una copia.
   El plan gratis de Supabase no guarda respaldos que puedas restaurar tú misma. */
const TABLAS_RESPALDO = ["clientes", "mascotas", "citas", "servicios", "servicios_anulados", "razas", "tipos_servicio",
  "grupos_recordatorio", "guias", "videos", "pendientes_descartados", "perfiles"];

async function descargarRespaldo() {
  const boton = $("#rep-respaldo");
  boton.disabled = true;
  boton.textContent = "Preparando respaldo…";
  try {
    await cargarScript(URL_EXCEL);
    const XLSX = window.XLSX;
    const libro = XLSX.utils.book_new();
    const resumen = [["Tabla", "Filas"]];
    for (const tabla of TABLAS_RESPALDO) {
      let filas;
      try {
        // Solo los perfiles de ESTE negocio (DALU podría ver los de todos).
        filas = await traerTodo(() => {
          const consulta = db.from(tabla).select("*").order("id");
          return tabla === "perfiles" && estado.negocio && estado.negocio.id ? consulta.eq("negocio_id", estado.negocio.id) : consulta;
        });
      } catch (error) { continue; } // si la tabla no existe en esta base, se salta
      resumen.push([tabla, filas.length]);
      const hoja = filas.length ? XLSX.utils.json_to_sheet(filas.map((f) => Object.fromEntries(Object.entries(f)
        .map(([k, v]) => [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v]))))
        : XLSX.utils.aoa_to_sheet([["(sin filas)"]]);
      XLSX.utils.book_append_sheet(libro, hoja, tabla.slice(0, 31));
    }
    const portada = XLSX.utils.aoa_to_sheet([[`Respaldo de ${nombreNegocio()}`],
      ["Generado", new Date().toLocaleString("es-CO", { timeZone: ZONA })], [], ...resumen]);
    XLSX.utils.book_append_sheet(libro, portada, "Contenido");
    libro.SheetNames.unshift(libro.SheetNames.pop()); // "Contenido" primero
    XLSX.writeFile(libro, `Respaldo_${nombreSeguroArchivo(nombreNegocio())}_${hoyISO()}.xlsx`);
    try { localStorage.setItem("ultimo-respaldo", hoyISO()); } catch (e) { /* sin almacenamiento */ }
    aviso("Respaldo descargado. Guárdalo en un lugar seguro (por ejemplo, Google Drive).");
    pintarUltimoRespaldo();
  } catch (error) {
    aviso(mensajeError(error), true);
  } finally {
    if ($("#rep-respaldo")) { boton.disabled = false; boton.textContent = "⬇ Descargar respaldo completo"; }
  }
}

function pintarUltimoRespaldo() {
  const caja = $("#rep-ultimo-respaldo");
  if (!caja) return;
  let ultimo = null;
  try { ultimo = localStorage.getItem("ultimo-respaldo"); } catch (e) { /* sin almacenamiento */ }
  const dias = ultimo ? diasEntre(ultimo, hoyISO()) : null;
  caja.innerHTML = ultimo
    ? `Último respaldo desde este navegador: <strong>${esc(fechaCorta(ultimo))}</strong>${dias > 30 ? ' · <span class="mal">hace más de un mes, descarga uno nuevo</span>' : ""}`
    : "Todavía no has descargado un respaldo desde este navegador. Se recomienda uno cada mes.";
}

const nombreSeguroArchivo = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "") || "reporte";

PANTALLAS.reportes = {
  html: () => {
    const { desde, hasta } = fechasReporte || fechasDeRango(rangoReporte);
    return `<h1>Reportes</h1>
    <p class="suave">Elige el período. El resumen se calcula solo y puedes descargar todo en Excel
    (historial, mascotas, dueños, citas, totales por servicio y por mes).</p>
    <div class="tarjeta">
      <div class="filtros">${Object.entries(RANGOS).map(([clave, texto]) =>
        `<button class="chip" data-rango="${clave}" aria-pressed="${clave === rangoReporte}">${texto}</button>`).join("")}</div>
      <div class="fila-nueva">
        <div><label for="rep-desde">Desde</label><input id="rep-desde" type="date" value="${desde}" data-vacio="Desde el inicio"></div>
        <div><label for="rep-hasta">Hasta</label><input id="rep-hasta" type="date" value="${hasta}" data-vacio="Hasta hoy"></div>
        <div><button class="btn" id="rep-excel" type="button" disabled>⬇ Descargar Excel</button></div>
      </div>
    </div>
    <div id="rep-resultado"><p class="suave">Calculando…</p></div>
    <div class="tarjeta">
      <h2>Respaldo de la base de datos</h2>
      <p class="suave">Descarga una copia de <strong>todas</strong> tus tablas (clientes, mascotas, citas, servicios, precios…)
      en un Excel. Si algún día se pierde o se daña algo, con este archivo se puede recuperar.</p>
      <p class="suave" id="rep-ultimo-respaldo"></p>
      <button class="btn alt" id="rep-respaldo" type="button">⬇ Descargar respaldo completo</button>
    </div>`;
  },
  despues: async () => {
    $$("[data-rango]").forEach((b) => b.addEventListener("click", () => {
      rangoReporte = b.dataset.rango;
      const { desde, hasta } = fechasDeRango(rangoReporte);
      fijarFecha($("#rep-desde"), desde);
      fijarFecha($("#rep-hasta"), hasta);
      $$("[data-rango]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      cargarReporte();
    }));
    const alCambiarFecha = () => {
      rangoReporte = "personalizado";
      $$("[data-rango]").forEach((x) => x.setAttribute("aria-pressed", "false"));
      cargarReporte();
    };
    $("#rep-desde").addEventListener("change", alCambiarFecha);
    $("#rep-hasta").addEventListener("change", alCambiarFecha);
    $("#rep-excel").addEventListener("click", descargarExcel);
    $("#rep-respaldo").addEventListener("click", descargarRespaldo);
    pintarUltimoRespaldo();
    await cargarReporte();
  },
};
