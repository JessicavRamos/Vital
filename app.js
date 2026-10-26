"use strict";

/* =====================================================================
   DALU Vital · NÚCLEO: utilidades, login, menú y navegación
   ===================================================================== */


// Nombre del producto. El nombre de cada negocio cliente viene de la base (tabla "negocios").
const NOMBRE_PRODUCTO = "DALU Vital";

/* ---------- Utilidades generales ---------- */
const $ = (selector, raiz = document) => raiz.querySelector(selector);
const $$ = (selector, raiz = document) => Array.from(raiz.querySelectorAll(selector));

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
// Siempre se escapa el texto que viene de la base antes de mostrarlo.
const esc = (texto) => String(texto ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

const dinero = (n) =>
  n === null || n === undefined || n === "" ? "—" : "$" + Number(n).toLocaleString("es-CO");

const limpiarTelefono = (t) => String(t ?? "").replace(/[^\d+]/g, "");
const terminoSeguro = (t) => String(t ?? "").replace(/[,()*%\\"]/g, " ").trim();

// Filtro para buscar por mascota, dueño o CUALQUIERA de los dos teléfonos.
function filtroBusqueda(termino) {
  const t = terminoSeguro(termino);
  const digitos = limpiarTelefono(t);
  const tel = digitos.length >= 3 ? digitos : t;
  return `mascota.ilike.*${t}*,cliente.ilike.*${t}*,telefono.ilike.*${tel}*,telefono2.ilike.*${tel}*`;
}

function debounce(funcion, espera = 300) {
  let temporizador;
  return (...argumentos) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => funcion(...argumentos), espera);
  };
}

/* ---------- Fechas (siempre en hora de Bogotá) ---------- */
const ZONA = "America/Bogota";
const hoyISO = () => new Date().toLocaleDateString("en-CA", { timeZone: ZONA }); // AAAA-MM-DD

function sumarDias(fechaISO, dias) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}
const diasEntre = (desde, hasta) =>
  Math.round((Date.parse(hasta + "T00:00:00Z") - Date.parse(desde + "T00:00:00Z")) / 86400000);
const inicioDiaBogota = (fechaISO) => new Date(fechaISO + "T00:00:00-05:00").toISOString();
const bogotaAISO = (valor) => new Date(valor + ":00-05:00").toISOString(); // "AAAA-MM-DDTHH:MM"

const diaDe = (f) => new Date(f).toLocaleDateString("en-CA", { timeZone: ZONA });
const horaDe = (f) =>
  new Date(f).toLocaleTimeString("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });
const diaTexto = (fechaISO) =>
  new Date(fechaISO + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
// En pantalla todas las fechas se ven igual: dd/mm/aaaa (ver fechaCorta más abajo).
const fechaTexto = (f) => fechaCorta(f);
const fechaHoraTexto = (f) => `${fechaCorta(diaDe(f))} · ${horaTexto(f)}`;
// Para mensajes de WhatsApp: "18 de octubre".
const fechaMensaje = (f) =>
  f ? new Date(String(f).slice(0, 10) + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long" }) : "";
const horaTexto = (f) =>
  new Date(f).toLocaleTimeString("es-CO", { timeZone: ZONA, hour: "numeric", minute: "2-digit" });
const fechaLarga = () =>
  new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA });

// Lista de horas cada 30 minutos (7:00 a. m. a 8:00 p. m.) para elegir sin escribir.
function opcionesHora(seleccionada = "10:00") {
  const horas = [];
  for (let h = 7; h <= 20; h++) {
    for (const m of ["00", "30"]) {
      if (h === 20 && m === "30") continue;
      horas.push(`${String(h).padStart(2, "0")}:${m}`);
    }
  }
  if (seleccionada && !horas.includes(seleccionada)) {
    horas.push(seleccionada);
    horas.sort();
  }
  return horas.map((v) => {
    const [h, m] = v.split(":").map(Number);
    return `<option value="${v}"${v === seleccionada ? " selected" : ""}>${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}</option>`;
  }).join("");
}

/* ---------- Precios, baño medicado y WhatsApp ---------- */
// El precio sugerido depende de estos tres nombres de servicio. No los renombres.
const COLUMNA_PRECIO = { "Baño": "precio_bano", "Corte": "precio_corte", "Corte y baño": "precio_corte_bano", "Uñas": "precio_unas" };
const SERVICIOS_CON_BANO = ["Baño", "Corte y baño"]; // los únicos que pueden ser medicados
function precioRaza(raza, servicio) {
  const columna = COLUMNA_PRECIO[servicio];
  return raza && columna ? (raza[columna] ?? null) : null;
}

// Casilla "baño medicado" con su recargo (+$8.000 / +$16.000 según el tamaño).
function htmlMedicado(p, medicado = false, recargo = "") {
  return `<div class="medicado" id="${p}-bloque">
    <label class="casilla"><input type="checkbox" id="${p}-medicado"${medicado ? " checked" : ""}> Baño medicado (otro champú)</label>
    <div id="${p}-recargo-caja"${medicado ? "" : " hidden"}>
      <label for="${p}-recargo">Recargo por champú medicado</label>
      <div class="fila-recargo">
        <input id="${p}-recargo" type="number" min="0" step="any" value="${esc(recargo)}">
        <button type="button" class="chip" data-recargo="${p}" data-valor="8000">+$8.000</button>
        <button type="button" class="chip" data-recargo="${p}" data-valor="16000">+$16.000</button>
      </div>
      <p class="suave">Según el tamaño del perro. Se suma al precio.</p>
    </div></div>`;
}

// Conecta la casilla con el campo de precio: al marcarla suma el recargo y al
// desmarcarla lo resta. Devuelve { fijar(n) } para avisar cuánto recargo ya incluye el precio.
function conectarMedicado(p, idPrecio, alCambiar) {
  const casilla = $(`#${p}-medicado`), recargo = $(`#${p}-recargo`), precio = $(idPrecio);
  let aplicado = casilla.checked ? (Number(recargo.value) || 0) : 0;
  const ajustar = () => {
    const nuevo = casilla.checked ? (Number(recargo.value) || 0) : 0;
    if (precio && precio.value !== "") precio.value = Math.max(0, Number(precio.value) - aplicado + nuevo);
    aplicado = nuevo;
    $(`#${p}-recargo-caja`).hidden = !casilla.checked;
    if (alCambiar) alCambiar();
  };
  casilla.addEventListener("change", ajustar);
  recargo.addEventListener("input", ajustar);
  $$(`[data-recargo="${p}"]`).forEach((b) => b.addEventListener("click", () => {
    recargo.value = b.dataset.valor;
    casilla.checked = true;
    ajustar();
  }));
  return { fijar: (n) => { aplicado = n; } };
}

function enlaceWhatsApp(telefono, mensaje) {
  let numero = String(telefono ?? "").replace(/\D/g, "");
  if (numero.length === 10) numero = "57" + numero; // indicativo de Colombia
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

/* ---------- Avisos y errores ---------- */
let temporizadorAviso;
// accion (opcional): { texto: "Deshacer", alHacer: () => … } muestra un botón dentro del aviso.
function aviso(mensaje, esError = false, accion = null) {
  const caja = $("#aviso");
  caja.textContent = mensaje;
  caja.className = "visible" + (esError ? " error" : "") + (accion ? " con-accion" : "");
  if (accion) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = accion.texto;
    boton.addEventListener("click", () => { caja.className = ""; accion.alHacer(); });
    caja.append(" ", boton);
  }
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { caja.className = ""; }, accion ? 7000 : 3800);
}

function mensajeError(error) {
  const texto = (error && error.message) || String(error);
  if (/invalid login credentials/i.test(texto)) return "Correo o contraseña incorrectos.";
  if (/could not find the function|function .* does not exist/i.test(texto))
    return "Falta actualizar la base de datos: ejecuta en Supabase el SQL de esta versión.";
  if (/rate limit|too many requests|security purposes/i.test(texto))
    return "Se enviaron demasiados correos seguidos. Espera unos minutos e intenta de nuevo.";
  if (/should be different from the old password/i.test(texto))
    return "La nueva contraseña debe ser diferente a la anterior.";
  if (/password should be at least/i.test(texto)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/does not exist|could not find the table|schema cache|column .* not found/i.test(texto))
    return "Falta actualizar la base de datos: ejecuta en Supabase el SQL de esta versión.";
  if (/failed to fetch|networkerror|load failed/i.test(texto))
    return "No hay conexión con la base de datos. Revisa tu internet y los datos de config.js.";
  if (/email not confirmed/i.test(texto))
    return "Tu correo aún no está confirmado. Confírmalo en Supabase (Authentication > Users).";
  if (/jwt expired/i.test(texto)) return "Tu sesión venció. Vuelve a iniciar sesión.";
  if (/permission denied|row-level security/i.test(texto))
    return "No tienes permiso para hacer esto. Inicia sesión de nuevo.";
  if (/duplicate key|unique constraint/i.test(texto))
    return "Ya existe un registro con ese dato (por ejemplo, otro cliente con ese teléfono o una raza repetida).";
  if (/foreign key/i.test(texto)) return "No se puede completar: este dato está en uso en otro lugar.";
  // Mensajes que escribimos nosotros en la base (en español) se muestran tal cual.
  if (/no tiene una invitación|database error saving new user/i.test(texto))
    return "Ese correo no tiene invitación. Pide al administrador de tu negocio que te invite y vuelve a intentar.";
  if (/user already registered/i.test(texto)) return "Ese correo ya tiene cuenta. Inicia sesión o usa «¿Olvidaste tu contraseña?».";
  if (/negocios_slug_key|duplicate key.*slug/i.test(texto)) return "Ya existe un negocio con esa dirección corta. Usa otra.";
  if (/^(Debes iniciar sesión|Escribe el motivo|Tu usuario no tiene un negocio|Solo el administrador puede invitar|Solo DALU|Ese correo|Escribe un correo válido|Rol no válido|Ese dato pertenece a otro negocio|El servicio no existe|La cita no existe|Una cita realizada no se puede reabrir|Elige el servicio de la cita|Debe quedar al menos un administrador)/.test(texto)) return texto;
  return `No se pudo completar. Detalle técnico: ${texto}`;
}

function mostrarError(caja, error) {
  if (caja) caja.innerHTML = `<p class="mal">✖ ${esc(mensajeError(error))}</p>`;
}

const configurado =
  typeof SUPABASE_URL === "string" && typeof SUPABASE_ANON_KEY === "string" &&
  !SUPABASE_URL.includes("PEGA_AQUI") && !SUPABASE_ANON_KEY.includes("PEGA_AQUI");

// ¿Se abrió la página desde el enlace del correo "recuperar contraseña"?
// Se revisa ANTES de crear el cliente de Supabase, que es quien lee y limpia ese enlace.
const RECUPERACION = (() => {
  const h = location.hash + "&" + location.search;
  if (/type=recovery/.test(h)) return { modo: "nueva" };
  if (/error_code=|error_description=/.test(h)) {
    return {
      modo: "error",
      texto: /otp_expired|expired/i.test(h)
        ? "El enlace para cambiar la contraseña venció o ya se usó. Pide uno nuevo."
        : "El enlace para cambiar la contraseña no es válido. Pide uno nuevo.",
    };
  }
  return null;
})();

const db = configurado && typeof supabase !== "undefined"
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/* ---------- Tablas con orden y filtro por columna ---------- */
const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const ESTADO_TABLAS = {}; // recuerda orden y filtros de cada tabla mientras la página esté abierta

function comparar(a, b) {
  const vacioA = a === null || a === undefined || a === "", vacioB = b === null || b === undefined || b === "";
  if (vacioA || vacioB) return vacioA === vacioB ? 0 : vacioA ? 1 : -1; // los vacíos siempre al final
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { sensitivity: "base", numeric: true });
}

/* columnas: [{ titulo, valor: (fila) => lo que se ordena,
                texto: (fila) => lo que se filtra (si no, se usa valor),
                filtro: "texto" | "lista" | false, ordenable: true|false, clase }]
   fila: (fila) => "<tr>…</tr>"     alPintar: (tbody, filasVisibles) => conectar botones */
function tablaInteractiva(caja, { id, columnas, filas, fila, alPintar, vacio = "No hay datos para mostrar." }) {
  const st = ESTADO_TABLAS[id] || (ESTADO_TABLAS[id] = { orden: null, dir: 1, filtros: {} });
  const textoDe = (c, r) => sinTildes(c.texto ? c.texto(r) : c.valor ? c.valor(r) : "");
  const opciones = (c) => [...new Map(filas.map((r) => {
    const original = String((c.texto ? c.texto(r) : c.valor(r)) ?? "").trim();
    return [sinTildes(original), original];
  }).filter(([clave]) => clave)).entries()].sort((a, b) => comparar(a[1], b[1]));
  // Si un filtro de lista quedó con un valor que ya no existe (por ejemplo, se borró la fila), se limpia.
  columnas.forEach((c, i) => {
    if (c.filtro === "lista" && st.filtros[i] && !opciones(c).some(([clave]) => clave === st.filtros[i])) delete st.filtros[i];
  });

  caja.innerHTML = `<div class="tabla-scroll"><table class="interactiva">
    <thead><tr>${columnas.map((c, i) => `<th${c.clase ? ` class="${c.clase}"` : ""}>${c.ordenable === false
      ? esc(c.titulo)
      : `<button type="button" class="orden" data-col="${i}" title="Ordenar por ${esc(c.titulo)}">${esc(c.titulo)} <span class="flecha-orden" aria-hidden="true"></span></button>`}</th>`).join("")}</tr>
    <tr class="fila-filtros">${columnas.map((c, i) => `<th${c.filtro ? ` data-label="${esc(c.titulo)}"` : ""}>${c.filtro === "lista"
      ? `<select data-filtro-col="${i}" aria-label="Filtrar ${esc(c.titulo)}"><option value="">Todos</option>${opciones(c).map(([clave, original]) =>
          `<option value="${esc(clave)}"${st.filtros[i] === clave ? " selected" : ""}>${esc(original)}</option>`).join("")}</select>`
      : c.filtro === "texto"
        ? `<input type="search" data-filtro-col="${i}" value="${esc(st.filtros[i] ?? "")}" placeholder="Filtrar…" aria-label="Filtrar ${esc(c.titulo)}">`
        : c.filtro === "fecha"
          ? `<input type="date" data-filtro-col="${i}" value="${esc(st.filtros[i] ?? "")}" data-vacio="Cualquier día" aria-label="Filtrar ${esc(c.titulo)} por día">`
          : ""}</th>`).join("")}</tr></thead>
    <tbody></tbody></table></div>
    <div class="pie-tabla"><p class="suave conteo" aria-live="polite"></p>
      <button type="button" class="btn chico alt limpiar-filtros" hidden>✕ Limpiar filtros</button></div>`;

  const tbody = $("tbody", caja), conteo = $(".conteo", caja);
  function pintarCuerpo() {
    let lista = filas.filter((r) => columnas.every((c, i) => {
      const f = st.filtros[i];
      if (!f) return true;
      if (c.filtro === "fecha") return String(c.dia ? c.dia(r) : c.valor(r) ?? "").slice(0, 10) === f;
      return c.filtro === "lista" ? textoDe(c, r) === f : textoDe(c, r).includes(sinTildes(f));
    }));
    if (st.orden !== null && columnas[st.orden]) {
      const c = columnas[st.orden];
      lista = lista.slice().sort((a, b) => comparar(c.valor(a), c.valor(b)) * st.dir);
    }
    tbody.innerHTML = lista.length ? lista.map(fila).join("")
      : `<tr class="vacia"><td colspan="${columnas.length}" class="suave">${esc(vacio)}</td></tr>`;
    // En el celular cada fila se ve como tarjeta: cada dato lleva el nombre de su columna.
    if (lista.length) $$("tr", tbody).forEach((tr) => Array.from(tr.children).forEach((td, i) => {
      if (columnas[i] && columnas[i].titulo) td.dataset.label = columnas[i].titulo;
      td.innerHTML = `<div class="celda">${td.innerHTML}</div>`;
    }));
    conteo.textContent = lista.length === filas.length
      ? `${filas.length} ${filas.length === 1 ? "registro" : "registros"}`
      : `Mostrando ${lista.length} de ${filas.length} registros`;
    $$("button.orden", caja).forEach((b) => {
      const activa = Number(b.dataset.col) === st.orden;
      b.closest("th").setAttribute("aria-sort", activa ? (st.dir === 1 ? "ascending" : "descending") : "none");
      $(".flecha-orden", b).textContent = activa ? (st.dir === 1 ? "▲" : "▼") : "↕";
    });
    // "Limpiar filtros" solo aparece si hay algún filtro u orden puesto.
    const hayFiltros = Object.values(st.filtros).some(Boolean) || st.orden !== null;
    $(".limpiar-filtros", caja).hidden = !hayFiltros;
    if (alPintar) alPintar(tbody, lista);
  }
  $(".limpiar-filtros", caja).addEventListener("click", () => {
    st.filtros = {};
    st.orden = null;
    st.dir = 1;
    tablaInteractiva(caja, { id, columnas, filas, fila, alPintar, vacio }); // se vuelve a dibujar con todo vacío
  });
  $$("button.orden", caja).forEach((b) => b.addEventListener("click", () => {
    const col = Number(b.dataset.col);
    if (st.orden !== col) { st.orden = col; st.dir = 1; }
    else if (st.dir === 1) st.dir = -1;
    else st.orden = null; // tercer clic: sin orden
    pintarCuerpo();
  }));
  $$("[data-filtro-col]", caja).forEach((entrada) => entrada.addEventListener("input", () => {
    st.filtros[Number(entrada.dataset.filtroCol)] = entrada.value;
    pintarCuerpo();
  }));
  pintarCuerpo();
}

// Trae TODAS las filas de una consulta (Supabase entrega máximo 1.000 por vez).
async function traerTodo(crearConsulta) {
  const tam = 1000;
  let desde = 0, todo = [];
  for (;;) {
    const filas = await q(crearConsulta().range(desde, desde + tam - 1));
    todo = todo.concat(filas);
    if (filas.length < tam) return todo;
    desde += tam;
  }
}

// Carga un script externo solo cuando se necesita (por ejemplo, la librería de Excel).
const scriptsCargados = {};
function cargarScript(url) {
  if (!scriptsCargados[url]) {
    scriptsCargados[url] = new Promise((resolver, rechazar) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = resolver;
      s.onerror = () => { delete scriptsCargados[url]; rechazar(new Error("No se pudo descargar la librería. Revisa tu internet.")); };
      document.head.appendChild(s);
    });
  }
  return scriptsCargados[url];
}

/* ---------- Fechas cortas (dd/mm/aaaa) ---------- */
const fechaCorta = (f) => {
  if (!f) return "—";
  const [a, m, d] = String(f).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
// "2026-11-04" → "4 de noviembre de 2026"
const fechaPago = (f) => {
  if (!f) return "—";
  const [a, m, d] = String(f).slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
};
// Mismo día del mes siguiente (31 de enero → 28/29 de febrero)
const masUnMes = (f) => {
  const [a, m, d] = String(f).slice(0, 10).split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m, Math.min(d, ultimoDia))).toISOString().slice(0, 10);
};
// Días que faltan desde hoy (Colombia) hasta una fecha AAAA-MM-DD (negativo = ya pasó)
const diasHasta = (f) => {
  const utc = (x) => { const [a, m, d] = String(x).slice(0, 10).split("-").map(Number); return Date.UTC(a, m - 1, d); };
  return Math.round((utc(f) - utc(hoyISO())) / 86400000);
};
// Estado de la suscripción según la fecha de renovación (próximo pago).
// Amable: amarillo cerca de la fecha y en los días de gracia; rojo solo después.
const DIAS_GRACIA = 5;
function estadoPago(proximo) {
  if (!proximo) return { texto: "Sin pagos registrados", clase: "gris" };
  const dias = diasHasta(proximo);
  if (dias < -DIAS_GRACIA) return { texto: "Renovación vencida", clase: "atrasada", dias, aviso: true };
  if (dias < 0) return { texto: "Renovación pendiente", clase: "", dias, aviso: true };
  if (dias === 0) return { texto: "Se renueva hoy", clase: "", dias, aviso: true };
  if (dias <= DIAS_GRACIA) return { texto: `Se renueva en ${dias} ${dias === 1 ? "día" : "días"}`, clase: "", dias, aviso: dias <= 3 };
  return { texto: "Al día", clase: "ok", dias };
}

/* ---------- Planes y contacto con DALU (marketing) ---------- */
let PLANES_CACHE = null;
async function planesDisponibles() {
  if (!PLANES_CACHE) PLANES_CACHE = await q(db.from("planes").select("*").order("orden"));
  return PLANES_CACHE;
}
// El plan siguiente que da más de algo ("max_usuarios" o "max_sedes")
async function siguientePlan(campo) {
  if (!estado.plan) return null;
  try {
    const planes = await planesDisponibles();
    const actual = planes.find((p) => p.id === estado.plan.id) || estado.plan;
    return planes.find((p) => p.orden > actual.orden && Number(p[campo]) > Number(actual[campo])) || null;
  } catch (error) {
    return null;
  }
}
const enlaceDalu = (mensaje) => enlaceWhatsApp(typeof DALU_WHATSAPP === "string" ? DALU_WHATSAPP : "", mensaje);
const mensajeMejorarPlan = (plan) =>
  `Hola, DALU. Soy ${nombreUsuario()} de ${nombreNegocio()}. Quiero ${plan ? `pasar al plan ${plan}` : "mejorar mi plan"} de DALU Vital.`;
const mensajeYaPague = () =>
  `Hola, DALU. Soy ${nombreUsuario()} de ${nombreNegocio()}. Ya pagué la renovación de DALU Vital. Te envío el comprobante.`;
// Aviso al llegar al límite del plan, con el siguiente plan y un botón para pedirlo
async function pintarAvisoLimite(caja, campo, sustantivo) {
  if (!caja) return;
  const siguiente = await siguientePlan(campo);
  caja.innerHTML = `Llegaste al máximo de ${sustantivo} de tu plan.
    ${siguiente ? `Con <strong>${esc(siguiente.nombre)}</strong> tienes hasta <strong>${siguiente[campo]}</strong>.` : "Escríbele a DALU para ampliarlo."}
    <a class="btn chico" target="_blank" rel="noopener" data-mejorar-plan href="${esc(enlaceDalu(mensajeMejorarPlan(siguiente && siguiente.nombre)))}">Quiero mejorar mi plan</a>`;
}

const diaSemanaCorto = (fechaISO) =>
  new Date(fechaISO + "T12:00:00").toLocaleDateString("es-CO", { weekday: "short" }).replace(".", "");
// Celda de fecha y hora de una cita: "18/10/2026" y debajo "dom · 1:00 p. m."
const htmlFechaHora = (fh) => {
  const d = diaDe(fh);
  return `<strong class="sin-salto">${fechaCorta(d)}</strong><div class="suave sin-salto">${esc(diaSemanaCorto(d))} · ${esc(horaTexto(fh))}</div>`;
};

/* ---------- Calendario propio para los campos de fecha ----------
   Cada <input type="date"> se cambia solo por un botón "18/10/2026 · dom" que abre un
   calendario en español. El campo original sigue guardando el valor (AAAA-MM-DD) y avisa
   con los eventos "input" y "change", así el resto del código no cambia. */
const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_CORTOS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];

function mejorarFecha(input) {
  if (input.dataset.mejorada) return;
  input.dataset.mejorada = "1";
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "campo-fecha";
  const etiqueta = input.id && document.querySelector(`label[for="${input.id}"]`);
  boton.setAttribute("aria-label", (etiqueta ? etiqueta.textContent.replace("*", "").trim() : input.getAttribute("aria-label") || "Fecha") + ": elegir fecha");
  input.classList.add("fecha-oculta");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.after(boton);
  if (etiqueta) etiqueta.addEventListener("click", (e) => { e.preventDefault(); boton.focus(); boton.click(); });
  input._pintarFecha = () => {
    boton.innerHTML = input.value
      ? `<span class="cf-texto">${esc(fechaCorta(input.value))}</span><span class="cf-dia">${esc(diaSemanaCorto(input.value))}</span><span class="cf-icono" aria-hidden="true">📅</span>`
      : `<span class="cf-texto cf-vacio">${esc(input.dataset.vacio || "Elegir fecha")}</span><span class="cf-icono" aria-hidden="true">📅</span>`;
  };
  input.addEventListener("change", input._pintarFecha);
  input.addEventListener("input", input._pintarFecha);
  boton.addEventListener("click", () => abrirCalendario(input, boton));
  input._pintarFecha();
}

// Pone una fecha por código (y actualiza el botón que se ve).
function fijarFecha(input, valor) {
  if (!input) return;
  input.value = valor || "";
  if (input._pintarFecha) input._pintarFecha();
}

function elegirFecha(input, valor) {
  fijarFecha(input, valor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function abrirCalendario(input, boton) {
  if (boton.dataset.calAbierto) { cerrarCalendario(); return; }
  cerrarCalendario();
  const hoy = hoyISO();
  const base = input.value || hoy;
  let anio = Number(base.slice(0, 4)), mes = Number(base.slice(5, 7)) - 1;
  const cal = document.createElement("div");
  cal.className = "calendario";
  cal.setAttribute("role", "dialog");
  cal.setAttribute("aria-label", "Elegir fecha");
  (boton.closest("dialog") || document.body).appendChild(cal);
  boton.dataset.calAbierto = "1";

  const pintar = () => {
    const primero = new Date(Date.UTC(anio, mes, 1));
    const huecos = (primero.getUTCDay() + 6) % 7; // semana empieza el lunes
    const diasMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
    let celdas = "";
    for (let i = 0; i < huecos; i++) celdas += "<span></span>";
    for (let d = 1; d <= diasMes; d++) {
      const iso = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const clases = [iso === hoy ? "es-hoy" : "", iso === input.value ? "elegido" : ""].join(" ").trim();
      celdas += `<button type="button" data-fecha="${iso}"${clases ? ` class="${clases}"` : ""}${iso === input.value ? ' aria-pressed="true"' : ""}
        aria-label="${d} de ${NOMBRES_MES[mes]} de ${anio}">${d}</button>`;
    }
    cal.innerHTML = `<div class="cal-cabeza">
        <button type="button" data-mes="-1" aria-label="Mes anterior">‹</button>
        <strong>${NOMBRES_MES[mes].charAt(0).toUpperCase() + NOMBRES_MES[mes].slice(1)} ${anio}</strong>
        <button type="button" data-mes="1" aria-label="Mes siguiente">›</button>
      </div>
      <div class="cal-semana">${DIAS_CORTOS.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="cal-dias">${celdas}</div>
      <div class="cal-pie">
        <button type="button" data-cal="hoy">Hoy</button>
        ${input.required ? "" : '<button type="button" data-cal="borrar">Borrar</button>'}
      </div>`;
  };
  pintar();

  cal.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.mes) {
      mes += Number(b.dataset.mes);
      if (mes < 0) { mes = 11; anio--; } else if (mes > 11) { mes = 0; anio++; }
      pintar();
      return;
    }
    if (b.dataset.fecha) elegirFecha(input, b.dataset.fecha);
    else if (b.dataset.cal === "hoy") elegirFecha(input, hoy);
    else if (b.dataset.cal === "borrar") elegirFecha(input, "");
    cerrarCalendario();
    boton.focus();
  });

  // Teclado: flechas mueven el día (← → un día, ↑ ↓ una semana), RePág/AvPág cambian de mes,
  // Inicio/Fin van al primer/último día del mes, Enter o espacio eligen.
  cal.addEventListener("keydown", (e) => {
    const actual = e.target.closest("button[data-fecha]");
    if (!actual) return;
    const pasos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let destino = null;
    if (pasos[e.key]) destino = sumarDias(actual.dataset.fecha, pasos[e.key]);
    else if (e.key === "PageUp" || e.key === "PageDown") {
      const [a, m, d] = actual.dataset.fecha.split("-").map(Number);
      const nuevo = new Date(Date.UTC(a, m - 1 + (e.key === "PageUp" ? -1 : 1), 1));
      const ultimo = new Date(Date.UTC(nuevo.getUTCFullYear(), nuevo.getUTCMonth() + 1, 0)).getUTCDate();
      nuevo.setUTCDate(Math.min(d, ultimo));
      destino = nuevo.toISOString().slice(0, 10);
    } else if (e.key === "Home") destino = actual.dataset.fecha.slice(0, 8) + "01";
    else if (e.key === "End") destino = $$("button[data-fecha]", cal).pop().dataset.fecha;
    if (!destino) return;
    e.preventDefault();
    const nuevoAnio = Number(destino.slice(0, 4)), nuevoMes = Number(destino.slice(5, 7)) - 1;
    if (nuevoAnio !== anio || nuevoMes !== mes) { anio = nuevoAnio; mes = nuevoMes; pintar(); }
    const b = $(`button[data-fecha="${destino}"]`, cal);
    if (b) b.focus();
  });

  // Se ubica debajo del botón (o encima si no cabe).
  const r = boton.getBoundingClientRect();
  const ancho = cal.offsetWidth, alto = cal.offsetHeight;
  let y = r.bottom + 4;
  if (y + alto > window.innerHeight - 8) y = Math.max(8, r.top - alto - 4);
  cal.style.left = Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)) + "px";
  cal.style.top = y + "px";
  const elegido = $("button.elegido", cal) || $("button.es-hoy", cal);
  if (elegido) elegido.focus();

  setTimeout(() => {
    document.addEventListener("click", cerrarCalendarioFuera, true);
    document.addEventListener("keydown", cerrarCalendarioEsc);
    window.addEventListener("resize", cerrarCalendario);
  }, 0);
}
function cerrarCalendario() {
  $$(".calendario").forEach((c) => c.remove());
  $$("[data-cal-abierto]").forEach((b) => b.removeAttribute("data-cal-abierto"));
  document.removeEventListener("click", cerrarCalendarioFuera, true);
  document.removeEventListener("keydown", cerrarCalendarioEsc);
  window.removeEventListener("resize", cerrarCalendario);
}
function cerrarCalendarioFuera(e) {
  if (e.target.closest(".calendario")) return;
  const mismo = e.target.closest("[data-cal-abierto]");
  cerrarCalendario();
  if (mismo) e.stopPropagation();
}
function cerrarCalendarioEsc(e) { if (e.key === "Escape") cerrarCalendario(); }

// Cualquier campo de fecha que aparezca en la página se mejora solo.
function vigilarFechas() {
  $$('input[type="date"]').forEach(mejorarFecha);
  new MutationObserver((cambios) => {
    for (const c of cambios) for (const n of c.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches && n.matches('input[type="date"]')) mejorarFecha(n);
      if (n.querySelectorAll) n.querySelectorAll('input[type="date"]').forEach(mejorarFecha);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

/* ---------- Menú de acciones "⋯" (se abre encima de todo, también dentro de tablas) ---------- */
// opciones: [{ texto, peligro?, alHacer }]
function abrirMenu(boton, opciones) {
  cerrarMenu();
  const menu = document.createElement("div");
  menu.className = "menu-flotante";
  menu.setAttribute("role", "menu");
  opciones.forEach((o) => {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "menuitem");
    item.textContent = o.texto;
    if (o.peligro) item.className = "peligro";
    item.addEventListener("click", () => { cerrarMenu(); o.alHacer(); });
    menu.appendChild(item);
  });
  (boton.closest("dialog") || document.body).appendChild(menu);
  const r = boton.getBoundingClientRect();
  const ancho = menu.offsetWidth, alto = menu.offsetHeight;
  let x = Math.min(r.right - ancho, window.innerWidth - ancho - 8);
  let y = r.bottom + 4;
  if (y + alto > window.innerHeight - 8) y = Math.max(8, r.top - alto - 4);
  menu.style.left = Math.max(8, x) + "px";
  menu.style.top = y + "px";
  boton.setAttribute("aria-expanded", "true");
  menu.dataset.dueno = "1";
  boton.dataset.menuAbierto = "1";
  menu.querySelector("button").focus();
  setTimeout(() => {
    document.addEventListener("click", cerrarMenuFuera, true);
    window.addEventListener("scroll", cerrarMenu, true);
    window.addEventListener("resize", cerrarMenu);
    document.addEventListener("keydown", cerrarMenuEsc);
  }, 0);
}
function cerrarMenu() {
  $$(".menu-flotante").forEach((m) => m.remove());
  $$("[data-menu-abierto]").forEach((b) => { b.removeAttribute("data-menu-abierto"); b.setAttribute("aria-expanded", "false"); });
  document.removeEventListener("click", cerrarMenuFuera, true);
  window.removeEventListener("scroll", cerrarMenu, true);
  window.removeEventListener("resize", cerrarMenu);
  document.removeEventListener("keydown", cerrarMenuEsc);
}
function cerrarMenuFuera(e) {
  if (e.target.closest(".menu-flotante")) return;
  const mismoBoton = e.target.closest("[data-menu-abierto]");
  cerrarMenu();
  if (mismoBoton) e.stopPropagation(); // un segundo clic en ⋯ solo cierra el menú
}
function cerrarMenuEsc(e) { if (e.key === "Escape") cerrarMenu(); }
const botonMenu = (id, etiqueta = "Más acciones") =>
  `<button type="button" class="btn chico alt solo-icono" data-menu="${id}" aria-haspopup="menu" aria-expanded="false" title="${esc(etiqueta)}" aria-label="${esc(etiqueta)}">⋯</button>`;

/* ---------- Pedir el motivo de una cancelación ---------- */
const MOTIVOS_RAPIDOS = ["El cliente canceló", "El cliente no llegó", "Error al registrar", "Precio o servicio equivocado"];
function pedirMotivo({ titulo, texto, aviso: advertencia = "", boton = "Sí, cancelar" }) {
  return new Promise((resolver) => {
    const dialogo = abrirDialogo(`<form id="form-motivo">
      <h2>${esc(titulo)}</h2>
      <p>${texto}</p>
      ${advertencia ? `<p class="aviso-fijo">${advertencia}</p>` : ""}
      <label for="m-motivo">Motivo *</label>
      <div class="filtros chips-motivo">${MOTIVOS_RAPIDOS.map((m) => `<button type="button" class="chip" data-motivo="${esc(m)}">${esc(m)}</button>`).join("")}</div>
      <input id="m-motivo" maxlength="200" placeholder="Escribe o elige un motivo">
      <p class="suave">Quedará registrado que lo cancelaste tú (${esc([nombreUsuario(), estado.sesion && estado.sesion.user && estado.sesion.user.email].filter(Boolean).join(" · "))}), con la fecha y la hora.</p>
      <p id="m-error" class="error" role="alert"></p>
      <div class="acciones">
        <button type="button" class="btn alt" id="m-volver">Volver</button>
        <button type="submit" class="btn peligro-lleno">${esc(boton)}</button>
      </div></form>`, "dialogo-motivo");
    let respuesta = null;
    $$("[data-motivo]", dialogo).forEach((b) => b.addEventListener("click", () => {
      $("#m-motivo").value = b.dataset.motivo;
      $$("[data-motivo]", dialogo).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }));
    $("#m-volver").addEventListener("click", () => cerrarDialogo("dialogo-motivo"));
    $("#form-motivo").addEventListener("submit", (e) => {
      e.preventDefault();
      const motivo = $("#m-motivo").value.trim();
      if (!motivo) { $("#m-error").textContent = "Escribe o elige el motivo."; return; }
      respuesta = motivo;
      cerrarDialogo("dialogo-motivo");
    });
    dialogo.addEventListener("close", () => resolver(respuesta), { once: true });
    $("#m-motivo").focus();
  });
}

/* ---------- Confirmar una acción (reemplaza window.confirm, que en celular se ve feo) ----------
   confirmar({ titulo, texto, boton, peligro }) → Promise<true|false> */
function confirmar({ titulo, texto = "", boton = "Sí, continuar", peligro = false }) {
  return new Promise((resolver) => {
    const dialogo = abrirDialogo(`<form id="form-confirmar">
      <h2>${esc(titulo)}</h2>
      ${texto ? `<p>${esc(texto).replace(/\n/g, "<br>")}</p>` : ""}
      <div class="acciones">
        <button type="button" class="btn alt" id="c-volver">Volver</button>
        <button type="submit" class="btn${peligro ? " peligro-lleno" : ""}" id="c-si">${esc(boton)}</button>
      </div></form>`, "dialogo-confirmar");
    let respuesta = false;
    $("#c-volver").addEventListener("click", () => cerrarDialogo("dialogo-confirmar"));
    $("#form-confirmar").addEventListener("submit", (e) => {
      e.preventDefault();
      respuesta = true;
      cerrarDialogo("dialogo-confirmar");
    });
    dialogo.addEventListener("close", () => resolver(respuesta), { once: true });
    $("#c-volver").focus();
  });
}

// Texto "Cancelado por Jessica · 18/10/2026 10:30 a. m. · Motivo"
function htmlAuditoria(por, en, motivo, palabra = "") {
  if (!por && !en && !motivo) return "";
  return `<div class="auditoria">${palabra ? esc(palabra) + (por ? " por" : "") : (por ? "Por" : "")}${por ? ` <strong>${esc(por)}</strong>` : ""}${en ? ` · ${esc(fechaCorta(diaDe(en)))} ${esc(horaTexto(en))}` : ""}${motivo ? `<div>“${esc(motivo)}”</div>` : ""}</div>`;
}

/* ---------- WhatsApp: avisar que ya puede recoger la mascota ---------- */
// Solo el primer nombre del dueño, con mayúscula inicial ("maria de los angeles" → "Maria").
function primerNombre(nombre) {
  const palabra = String(nombre ?? "").trim().split(/\s+/)[0] || "";
  return palabra.charAt(0).toUpperCase() + palabra.slice(1);
}

function mensajeRecoger(cliente, mascota) {
  return `¡Hola, ${primerNombre(cliente)}! Ya puedes venir por ${mascota} en ${nombreNegocio()}.

¡Te esperamos!`;
}

// Recordatorio de una cita pendiente: nombre, mascota, fecha y hora (y el servicio).
function mensajeRecordatorioCita(cita) {
  const dia = diaDe(cita.fecha_hora);
  const hoy = hoyISO();
  const cuando = dia === hoy ? "hoy" : dia === sumarDias(hoy, 1) ? "mañana" : `el ${diaTexto(dia).replace(",", "")}`;
  const servicio = cita.servicio ? ` (${String(cita.servicio).toLowerCase()})` : "";
  const hora = horaTexto(cita.fecha_hora).replace(/\s+/g, " ");
  return `¡Hola, ${primerNombre(cita.cliente)}! Te recordamos la cita de ${cita.mascota}${servicio} en ${nombreNegocio()} ${cuando} a las ${hora}${hora.endsWith(".") ? "" : "."}

¡Te esperamos!`;
}

// Ventana para revisar el mensaje antes de abrir WhatsApp.
function abrirDialogoWhatsApp({ titulo, intro = "", cita, mensaje, boton = "Enviar por WhatsApp" }) {
  const telefono = cita.telefono || cita.telefono2;
  abrirDialogo(`<div>
    <h2>${esc(titulo)}</h2>
    ${intro}
    ${telefono
      ? `<p class="suave">Mensaje para ${esc(cita.cliente)} (${esc(telefono)}):</p>
         <p class="vista-mensaje">${esc(mensaje)}</p>`
      : '<p class="suave">Este cliente no tiene teléfono guardado.</p>'}
    <div class="acciones">
      <button type="button" class="btn alt" id="w-cerrar">Cerrar</button>
      ${telefono ? `<button type="button" class="btn" id="w-enviar">${esc(boton)}</button>` : ""}
    </div></div>`);
  $("#w-cerrar").addEventListener("click", () => cerrarDialogo());
  const enviar = $("#w-enviar");
  if (enviar) enviar.addEventListener("click", () => {
    window.open(enlaceWhatsApp(telefono, mensaje), "_blank", "noopener");
    cerrarDialogo();
  });
}

function abrirAvisoRecoger(cita) {
  abrirDialogoWhatsApp({
    titulo: "✔ Servicio terminado",
    intro: `<p><strong>${esc(cita.mascota)}</strong> quedó registrado en el historial. ¿Le avisas que ya puede recogerlo?</p>`,
    cita,
    mensaje: mensajeRecoger(cita.cliente, cita.mascota),
    boton: "Avisar por WhatsApp",
  });
}

function abrirRecordatorioCita(cita) {
  abrirDialogoWhatsApp({
    titulo: "Recordar la cita",
    intro: `<p><strong>${esc(cita.mascota)}</strong> · ${esc(cita.servicio ?? "")} · ${esc(fechaCorta(diaDe(cita.fecha_hora)))} ${esc(horaTexto(cita.fecha_hora))}</p>`,
    cita,
    mensaje: mensajeRecordatorioCita(cita),
    boton: "Enviar recordatorio",
  });
}

// Ejecuta una consulta y devuelve los datos (o lanza el error).
async function q(consulta) {
  const { data, error } = await consulta;
  if (error) throw error;
  return data;
}
// Ejecuta una consulta de conteo y devuelve el número.
async function contar(consulta) {
  const { count, error } = await consulta;
  if (error) throw error;
  return count ?? 0;
}

/* ---------- Cuadros de diálogo (ventanas emergentes) ---------- */
function abrirDialogo(html, id = "dialogo") {
  let dialogo = document.getElementById(id);
  if (!dialogo) {
    dialogo = document.createElement("dialog");
    dialogo.id = id;
    document.body.appendChild(dialogo);
  }
  dialogo.innerHTML = html;
  if (!dialogo.open) dialogo.showModal();
  return dialogo;
}
function cerrarDialogo(id = "dialogo") {
  const dialogo = document.getElementById(id);
  if (dialogo && dialogo.open) dialogo.close();
}

/* ---------- Estado, logo, usuario, menú y pantallas ---------- */
const estado = { rol: null, sinRoles: false, sesion: null, usuarioId: null, busqueda: "", agendarPrefill: null,
  logoUrl: null, recuperacion: RECUPERACION, negocio: null, esDalu: false,
  plan: null, sedes: [], sedesMias: [], sede: null, conSedes: false };

/* ---------- Sedes y plan ---------- */
// La agenda es de cada sede. Clientes, mascotas e historial son de toda la empresa.
// estado.sede = sede en la que se está trabajando (se elige arriba si tienes más de una).
const sedeActualId = () => (estado.sede ? estado.sede.id : null);
// Filtra una consulta por la sede actual (si la base aún no tiene sedes, no filtra).
const conSede = (consulta, columna = "sede_id") => (estado.conSedes && estado.sede ? consulta.eq(columna, estado.sede.id) : consulta);
const nombreSede = (id) => (estado.sedes.find((s) => s.id === id) || {}).nombre || "";
// ¿El plan incluye este módulo? (sin plan, todo queda disponible)
const moduloActivo = (modulo) => !modulo || !estado.plan || estado.plan[modulo] !== false;
const claveSede = () => `dalu-vital-sede-${estado.usuarioId || ""}`;

async function cargarSedes() {
  estado.sedes = []; estado.sedesMias = []; estado.sede = null; estado.conSedes = false;
  if (!estado.sesion || !estado.negocio || !estado.negocio.id) return;
  try {
    const [sedes, mias] = await Promise.all([
      q(db.from("sedes").select("id,nombre,activo").eq("negocio_id", estado.negocio.id).order("id")),
      q(db.rpc("mis_sedes")),
    ]);
    estado.conSedes = true;
    estado.sedes = sedes;
    const ids = (mias || []).map(Number);
    estado.sedesMias = sedes.filter((s) => ids.includes(s.id) && s.activo);
    let guardada = null;
    try { guardada = Number(localStorage.getItem(claveSede())); } catch (error) { /* sin almacenamiento */ }
    estado.sede = estado.sedesMias.find((s) => s.id === guardada) || estado.sedesMias[0] || null;
  } catch (error) {
    // Base sin sedes (antes del SQL v13): una sola agenda, como antes.
    estado.conSedes = false;
  }
}
function cambiarSede(id) {
  estado.sede = estado.sedesMias.find((s) => s.id === Number(id)) || estado.sede;
  try { localStorage.setItem(claveSede(), String(estado.sede.id)); } catch (error) { /* sin almacenamiento */ }
  aviso(`Estás en ${estado.sede.nombre}.`);
  montarPantalla(claveActual());
}
function htmlSelectorSede() {
  if (!estado.conSedes || !estado.sede) return "";
  if (estado.sedesMias.length < 2) return `<span class="sede-actual" title="Sede">📍 ${esc(estado.sede.nombre)}</span>`;
  return `<label class="sede-actual">📍 <span class="oculto-visual">Sede</span>
    <select id="sede-actual" aria-label="Sede en la que estás trabajando">${estado.sedesMias.map((s) =>
      `<option value="${s.id}"${s.id === estado.sede.id ? " selected" : ""}>${esc(s.nombre)}</option>`).join("")}</select></label>`;
}

/* ---------- Negocio (cada cliente de DALU Vital) ---------- */
// Con sesión: el negocio del usuario. Sin sesión (entrada y videos públicos): el de la dirección
// (?negocio=petgarden), el último que se usó en este navegador o NEGOCIO_POR_DEFECTO de config.js.
// Si la base aún no tiene la tabla "negocios" (antes del SQL v11), "id" queda en null (modo anterior).
const CLAVE_NEGOCIO = "dalu-vital-negocio";
const negocioLegado = () => ({ id: null, nombre: typeof NOMBRE_NEGOCIO === "string" ? NOMBRE_NEGOCIO : NOMBRE_PRODUCTO, slug: null });
const nombreNegocio = () => (estado.negocio && estado.negocio.nombre) || NOMBRE_PRODUCTO;
// Carpeta del negocio en Storage ("" = archivos de antes, sin carpeta).
const carpetaNegocio = () => (estado.negocio && estado.negocio.id ? String(estado.negocio.id) : "");
const enCarpeta = (nombre) => (carpetaNegocio() ? `${carpetaNegocio()}/${nombre}` : nombre);

function recordarNegocio(negocio) {
  try {
    if (negocio && negocio.id) localStorage.setItem(CLAVE_NEGOCIO, JSON.stringify({ id: negocio.id, nombre: negocio.nombre, slug: negocio.slug }));
  } catch (error) { /* sin almacenamiento: no pasa nada */ }
}
function negocioRecordado() {
  try { return JSON.parse(localStorage.getItem(CLAVE_NEGOCIO) || "null"); } catch (error) { return null; }
}
// Enlace de cada negocio: https://vital.dalu.pro/petgarden (y /petgarden#/videos).
// GitHub Pages no conoce "/petgarden": muestra 404.html, que vuelve a la página con ?negocio=petgarden
// y aquí se deja otra vez la dirección bonita.
const SLUG_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const enlacePublico = (slug, ruta = "") => `${location.origin}/${encodeURIComponent(slug)}${ruta ? "#/" + ruta : ""}`;
function negocioPedido() {
  const porParametro = new URLSearchParams(location.search).get("negocio");
  const porRuta = location.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
  const slug = String(porParametro || (SLUG_VALIDO.test(porRuta) && porRuta !== "index" ? porRuta : "")).trim().toLowerCase();
  return SLUG_VALIDO.test(slug) ? slug : null;
}
// ?negocio=petgarden → /petgarden (sin recargar), para que el enlace se vea limpio.
function direccionBonita(slug) {
  if (!slug || !new URLSearchParams(location.search).has("negocio") || !/^\/(index\.html)?$/.test(location.pathname)) return;
  const resto = new URLSearchParams(location.search);
  resto.delete("negocio");
  const extra = resto.toString();
  try { history.replaceState(null, "", `/${slug}${extra ? "?" + extra : ""}${location.hash}`); } catch (error) { /* sin cambios */ }
}

async function cargarNegocioVisitante() {
  const pedido = negocioPedido();
  const recordado = negocioRecordado();
  const slug = (pedido || (recordado && recordado.slug) ||
    (typeof NEGOCIO_POR_DEFECTO === "string" ? NEGOCIO_POR_DEFECTO : "")).trim().toLowerCase();
  if (!slug) { estado.negocio = null; return; }
  try {
    const { data, error } = await db.from("negocios").select("id,nombre,slug").eq("slug", slug).maybeSingle();
    if (error) throw error;
    estado.negocio = data || null;
    if (data && pedido) { recordarNegocio(data); direccionBonita(data.slug); }
  } catch (error) {
    // Base sin la tabla "negocios" (antes del v11): todo funciona como antes.
    estado.negocio = /negocios|does not exist|schema cache/i.test((error && error.message) || "") ? negocioLegado() : recordado;
  }
}

// El logo vive en Supabase Storage (bucket público "logo"), en la carpeta del negocio.
// Se usa el más reciente. Pet Garden (negocio 1) conserva el logo que subió antes (sin carpeta).
async function cargarLogo() {
  estado.logoUrl = null;
  if (!estado.negocio) return;
  const buscar = async (carpeta) => {
    const { data, error } = await db.storage.from("logo")
      .list(carpeta, { limit: 10, sortBy: { column: "created_at", order: "desc" } });
    const archivo = !error && data ? data.find((f) => /^logo-/.test(f.name)) : null;
    return archivo ? db.storage.from("logo").getPublicUrl(carpeta ? `${carpeta}/${archivo.name}` : archivo.name).data.publicUrl : null;
  };
  try {
    estado.logoUrl = await buscar(carpetaNegocio());
    if (!estado.logoUrl && estado.negocio.id === 1) estado.logoUrl = await buscar("");
  } catch (error) {
    estado.logoUrl = null;
  }
}
const htmlLogo = (clase) => estado.logoUrl
  ? `<img class="${clase}" src="${esc(estado.logoUrl)}" alt="Logo de ${esc(nombreNegocio())}">`
  : `<span class="${clase} sin-logo" aria-hidden="true">🐾</span>`;

function nombreUsuario() {
  const u = estado.sesion && estado.sesion.user;
  const meta = (u && u.user_metadata) || {};
  return meta.nombre || meta.full_name || meta.name || "";
}

function pedirNombre() {
  abrirDialogo(`<form id="form-nombre">
    <h2>¿Cómo te llamas?</h2>
    <p class="suave">Este nombre aparece en la parte de abajo del menú.</p>
    <label for="n-nombre">Nombre</label>
    <input id="n-nombre" value="${esc(nombreUsuario())}" maxlength="60" required>
    <p id="n-error" class="error" role="alert"></p>
    <div class="acciones">
      <button type="button" class="btn alt" id="n-volver">Volver</button>
      <button type="submit" class="btn">Guardar</button>
    </div></form>`);
  $("#n-volver").addEventListener("click", () => cerrarDialogo());
  $("#form-nombre").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    try {
      const { data, error } = await db.auth.updateUser({ data: { nombre: $("#n-nombre").value.trim() } });
      if (error) throw error;
      estado.sesion = { ...estado.sesion, user: data.user };
      cerrarDialogo();
      pintar();
    } catch (error) {
      $("#n-error").textContent = mensajeError(error);
    }
  });
}

// Videos quedó oculto (su pantalla sigue en videos.js por si algún día se vuelve a usar).
const MENU = [
  { clave: "hoy", titulo: "Hoy", publica: false },
  { clave: "agendar", titulo: "Agendar", publica: false },
  { clave: "agenda", titulo: "Agenda", publica: false },
  { clave: "clientes", titulo: "Clientes y mascotas", publica: false },
  { clave: "reportes", titulo: "Reportes", publica: false, soloAdmin: true, modulo: "reportes" },
  { clave: "catalogos", titulo: "Catálogos", publica: false },
  { clave: "sedes", titulo: "Sedes", publica: false, soloAdmin: true },
  { clave: "usuarios", titulo: "Usuarios", publica: false, soloAdmin: true },
  { clave: "suscripcion", titulo: "Suscripción", publica: false, soloAdmin: true },
  { clave: "negocios", titulo: "Negocios · DALU", publica: false, soloDalu: true },
];

/* ---------- Roles: administrador y empleado ---------- */
const esAdmin = () => estado.rol === "administrador";
const puedeVer = (m) => (!m.soloAdmin || esAdmin()) && (!m.soloDalu || estado.esDalu) && moduloActivo(m.modulo);

// Lee el rol de la persona que inició sesión (tabla "perfiles").
async function cargarRol() {
  estado.plan = null;
  if (!estado.sesion) { estado.rol = null; estado.esDalu = false; return; }
  try {
    let { data, error } = await db.from("perfiles").select("rol,negocio_id,negocios(id,nombre,slug,planes(*))")
      .eq("id", estado.sesion.user.id).maybeSingle();
    if (error && /plan/i.test(error.message || "")) {
      // Base sin planes (antes del SQL v13)
      ({ data, error } = await db.from("perfiles").select("rol,negocio_id,negocios(id,nombre,slug)")
        .eq("id", estado.sesion.user.id).maybeSingle());
    }
    if (error && /negocio/i.test(error.message || "")) {
      // Base sin multinegocio (antes del SQL v11): un solo negocio, como antes.
      ({ data, error } = await db.from("perfiles").select("rol").eq("id", estado.sesion.user.id).maybeSingle());
      if (!error) estado.negocio = negocioLegado();
    } else if (!error) {
      const negocio = data && data.negocios ? data.negocios : null;
      // Tiene empresa pero no se ve: DALU la pausó.
      estado.negocioPausado = !!(data && data.negocio_id && !negocio);
      estado.plan = negocio && negocio.planes ? negocio.planes : null;
      estado.negocio = negocio ? { id: negocio.id, nombre: negocio.nombre, slug: negocio.slug } : null;
      recordarNegocio(estado.negocio);
    }
    if (error) throw error;
    estado.rol = data ? data.rol : "empleado";
    try {
      const r = await db.rpc("es_dalu");
      estado.esDalu = !r.error && r.data === true;
    } catch (e) { estado.esDalu = false; }
  } catch (error) {
    // Solo si la base aún no tiene roles (SQL v8 sin ejecutar) todo sigue como antes.
    // Ante cualquier otro error se entra como empleado (lo más seguro).
    const texto = (error && error.message) || String(error);
    if (/perfiles|does not exist|could not find the table|schema cache/i.test(texto) && !/permission|row-level/i.test(texto)) {
      estado.rol = "administrador";
      estado.sinRoles = true;
      estado.negocio = negocioLegado();
    } else {
      estado.rol = "empleado";
    }
    console.warn("Rol:", texto);
  }
}

// Cada archivo de pantalla agrega la suya aquí: PANTALLAS.hoy = { html, despues }
const PANTALLAS = {};

function claveActual() {
  const hash = location.hash.replace(/^#\/?/, "");
  return MENU.some((m) => m.clave === hash) ? hash : "hoy";
}

function htmlConfiguracion() {
  return `<main class="login"><div class="tarjeta">
    <h1>Falta un paso</h1>
    <p>Abre el archivo <strong>config.js</strong> y revisa que tenga tres datos: la URL de Supabase,
    y tu clave pública. Después guarda el archivo y recarga esta página.</p>
    <p class="suave">Si ya lo hiciste y ves este mensaje, revisa tu internet: la librería de Supabase no se pudo cargar.</p>
  </div></main>`;
}

function htmlLogin() {
  return `<main class="acceso">
    <div class="acceso-caja">
      <section class="acceso-marca">
        <div class="acceso-logo">${htmlLogo("logo-login")}</div>
        <h1>${esc(nombreNegocio())}</h1>
        <p>Panel de administración</p>
      </section>
      <section class="acceso-form">
        <form id="form-login">
          <h2>Bienvenida</h2>
          <p class="suave">Entra para ver tu panel.</p>
          <label for="correo">Correo</label>
          <input id="correo" type="email" autocomplete="username" required>
          <label for="clave">Contraseña</label>
          <input id="clave" type="password" autocomplete="current-password" required>
          <p id="error-login" class="error" role="alert"></p>
          <button class="btn grande" type="submit">Entrar</button>
          <p class="suave centrado"><button type="button" class="enlace pequeno" id="olvide">¿Olvidaste tu contraseña?</button></p>
          <p class="suave centrado"><button type="button" class="enlace pequeno" id="crear-cuenta">¿Te invitaron? Crea tu cuenta</button></p>
        </form>
        <p class="firma-producto">Con tecnología de <strong>${esc(NOMBRE_PRODUCTO)}</strong></p>
      </section>
    </div>
  </main>`;
}

// Pantalla para escribir la contraseña nueva (se llega desde el enlace del correo).
function htmlNuevaClave() {
  return `<main class="acceso">
    <div class="acceso-caja">
      <section class="acceso-marca">
        <div class="acceso-logo">${htmlLogo("logo-login")}</div>
        <h1>${esc(nombreNegocio())}</h1>
        <p>Crea tu nueva contraseña</p>
      </section>
      <section class="acceso-form">
        <form id="form-clave">
          <h2>Nueva contraseña</h2>
          <p class="suave">Escríbela dos veces. Debe tener al menos 6 caracteres.</p>
          <label for="nueva-clave">Nueva contraseña</label>
          <input id="nueva-clave" type="password" autocomplete="new-password" minlength="6" required>
          <label for="nueva-clave2">Repite la contraseña</label>
          <input id="nueva-clave2" type="password" autocomplete="new-password" minlength="6" required>
          <label class="casilla"><input type="checkbox" id="ver-clave"> Mostrar contraseña</label>
          <p id="error-clave" class="error" role="alert"></p>
          <button class="btn grande" type="submit">Guardar contraseña</button>
          <p class="suave centrado"><button type="button" class="enlace pequeno" id="cancelar-clave">Cancelar</button></p>
        </form>
        <p class="firma-producto">Con tecnología de <strong>${esc(NOMBRE_PRODUCTO)}</strong></p>
      </section>
    </div>
  </main>`;
}

function montarNuevaClave() {
  const formulario = $("#form-clave");
  $("#ver-clave").addEventListener("change", (e) => {
    $("#nueva-clave").type = $("#nueva-clave2").type = e.target.checked ? "text" : "password";
  });
  $("#cancelar-clave").addEventListener("click", async () => {
    estado.recuperacion = null;
    await db.auth.signOut();
    pintar();
  });
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const caja = $("#error-clave"), boton = $("button[type=submit]", formulario);
    const clave = $("#nueva-clave").value, repetida = $("#nueva-clave2").value;
    caja.textContent = "";
    if (clave.length < 6) { caja.textContent = "La contraseña debe tener al menos 6 caracteres."; return; }
    if (clave !== repetida) { caja.textContent = "Las dos contraseñas no son iguales."; return; }
    boton.disabled = true;
    boton.textContent = "Guardando…";
    try {
      const { error } = await db.auth.updateUser({ password: clave });
      if (error) throw error;
      estado.recuperacion = null;
      history.replaceState(null, "", location.pathname + location.search + "#/hoy");
      pintar();
      aviso("¡Listo! Tu contraseña quedó actualizada.");
    } catch (error) {
      caja.textContent = mensajeError(error);
      boton.disabled = false;
      boton.textContent = "Guardar contraseña";
    }
  });
  $("#nueva-clave").focus();
}

// Ventana "¿Olvidaste tu contraseña?": envía el correo con el enlace.
function pedirRecuperacion() {
  abrirDialogo(`<form id="form-olvide">
    <h2>Recuperar contraseña</h2>
    <p class="suave">Escribe tu correo. Te enviaremos un enlace para crear una contraseña nueva.</p>
    <label for="o-correo">Correo</label>
    <input id="o-correo" type="email" autocomplete="username" value="${esc($("#correo") ? $("#correo").value.trim() : "")}" required>
    <p id="o-mensaje" class="error" role="alert"></p>
    <div class="acciones">
      <button type="button" class="btn alt" id="o-volver">Volver</button>
      <button type="submit" class="btn">Enviar enlace</button>
    </div></form>`);
  $("#o-volver").addEventListener("click", () => cerrarDialogo());
  $("#form-olvide").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const caja = $("#o-mensaje"), boton = $("button[type=submit]", evento.target);
    caja.className = "error";
    caja.textContent = "";
    if (location.protocol === "file:") {
      caja.textContent = "Estás abriendo el sitio como archivo de tu computador. El enlace del correo solo funciona con el sitio publicado en internet (por ejemplo, GitHub Pages).";
      return;
    }
    boton.disabled = true;
    boton.textContent = "Enviando…";
    try {
      const { error } = await db.auth.resetPasswordForEmail($("#o-correo").value.trim(), {
        redirectTo: location.origin + "/",
      });
      if (error) throw error;
      caja.className = "bien";
      caja.textContent = "Si el correo está registrado, te llegará un enlace en unos minutos. Revisa también la carpeta de spam.";
      boton.textContent = "Enviado";
    } catch (error) {
      caja.textContent = mensajeError(error);
      boton.disabled = false;
      boton.textContent = "Enviar enlace";
    }
  });
  $("#o-correo").focus();
}

// Crear cuenta: solo funciona si el administrador del negocio (o DALU) invitó ese correo.
function pedirCrearCuenta() {
  abrirDialogo(`<form id="form-cuenta">
    <h2>Crear tu cuenta</h2>
    <p class="suave">Usa el mismo correo con el que te invitaron. Te llegará un correo para confirmarlo.</p>
    <label for="cc-nombre">Tu nombre</label>
    <input id="cc-nombre" maxlength="60" autocomplete="name" required>
    <label for="cc-correo">Correo</label>
    <input id="cc-correo" type="email" autocomplete="username" required>
    <label for="cc-clave">Contraseña (mínimo 6 caracteres)</label>
    <input id="cc-clave" type="password" autocomplete="new-password" minlength="6" required>
    <p id="cc-error" class="error" role="alert"></p>
    <div class="acciones">
      <button type="button" class="btn alt" id="cc-volver">Volver</button>
      <button type="submit" class="btn">Crear cuenta</button>
    </div></form>`);
  $("#cc-volver").addEventListener("click", () => cerrarDialogo());
  $("#form-cuenta").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const boton = $("button[type=submit]", evento.target);
    boton.disabled = true;
    boton.textContent = "Creando…";
    try {
      const { data, error } = await db.auth.signUp({
        email: $("#cc-correo").value.trim(),
        password: $("#cc-clave").value,
        options: { data: { nombre: $("#cc-nombre").value.trim() }, emailRedirectTo: location.origin + "/" },
      });
      if (error) throw error;
      cerrarDialogo();
      if (!data.session) aviso("¡Listo! Revisa tu correo y confirma la cuenta para poder entrar.");
    } catch (error) {
      $("#cc-error").textContent = mensajeError(error);
      boton.disabled = false;
      boton.textContent = "Crear cuenta";
    }
  });
  $("#cc-nombre").focus();
}

// Inició sesión pero su usuario no está en ningún negocio (y no es de DALU).
function htmlSinNegocio() {
  if (estado.negocioPausado) return `<main class="login"><div class="tarjeta">
    <h1>Tu empresa está pausada</h1>
    <p>El acceso de tu empresa a ${esc(NOMBRE_PRODUCTO)} está pausado por el momento. Tus datos están guardados y no se perdió nada.
    Comunícate con DALU para reactivarlo.</p>
    <button id="salir" class="btn">Cerrar sesión</button>
  </div></main>`;
  return `<main class="login"><div class="tarjeta">
    <h1>Tu usuario aún no tiene negocio</h1>
    <p>Iniciaste sesión como <strong>${esc(estado.sesion.user.email || "")}</strong>, pero todavía no estás en ningún negocio.
    Pide al administrador de tu negocio que te invite con este correo.</p>
    <button id="salir" class="btn">Cerrar sesión</button>
  </div></main>`;
}

function htmlPublico() {
  return `<div class="publico">
    <header class="cabecera"><span class="marca-lateral">${htmlLogo("logo-menu")}<span>${esc(nombreNegocio())}</span></span>
      <a class="btn alt" href="#/hoy">Entrar al panel</a></header>
    <main class="contenido"><section id="pantalla" tabindex="-1"></section></main>
  </div>`;
}

function htmlPanel(clave) {
  const enlaces = MENU.filter(puedeVer).map((m) =>
    `<a href="#/${m.clave}"${m.clave === clave ? ' aria-current="page"' : ""}>${esc(m.titulo)}</a>`).join("");
  const nombre = nombreUsuario();
  return `<div class="app">
    <aside class="lateral">
      <div class="cabeza-lateral">
        <div class="marca-lateral">${htmlLogo("logo-menu")}<span>${esc(nombreNegocio())}</span></div>
        <button type="button" class="menu-movil" id="menu-movil" aria-expanded="false" aria-controls="menu-secciones" aria-label="Abrir menú">
          <span class="actual">${esc((MENU.find((m) => m.clave === clave) || {}).titulo || "")}</span> ☰</button>
      </div>
      <nav aria-label="Secciones" id="menu-secciones">${enlaces}</nav>
      <div class="pie">
        <button id="perfil" class="usuario" title="Cambiar mi nombre">${nombre ? "👤 " + esc(nombre) : "👤 Escribe tu nombre"}
          <span class="rol-usuario">${esc(esAdmin() ? "Administrador" : "Colaborador")}</span></button>
        <button id="salir" class="btn alt">Cerrar sesión</button>
        <p class="firma-producto">${esc(NOMBRE_PRODUCTO)}</p>
      </div>
    </aside>
    <div class="principal">
      <div class="barra">
        <input id="buscador" type="search" placeholder="Buscar mascota, dueño o teléfono… (Enter)" aria-label="Búsqueda general">
        ${htmlSelectorSede()}
        <span class="suave">${esc(fechaLarga())}</span>
      </div>
      <section id="pantalla" tabindex="-1"></section>
    </div>
  </div>`;
}

/* ---------- Dibujar la página ---------- */
function montarPantalla(clave) {
  const pantalla = PANTALLAS[clave];
  $("#pantalla").innerHTML = pantalla.html();
  if (pantalla.despues) {
    Promise.resolve(pantalla.despues()).catch((error) => {
      const caja = $("#pantalla");
      if (caja) caja.insertAdjacentHTML("beforeend", `<p class="mal">✖ ${esc(mensajeError(error))}</p>`);
    });
  }
}

function montarLogin() {
  const formulario = $("#form-login");
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const boton = $("button[type=submit]", formulario);
    const caja = $("#error-login");
    caja.textContent = "";
    boton.disabled = true;
    boton.textContent = "Entrando…";
    try {
      const { error } = await db.auth.signInWithPassword({
        email: $("#correo").value.trim(),
        password: $("#clave").value,
      });
      if (error) throw error;
      // Si todo sale bien, onAuthStateChange vuelve a dibujar la página.
    } catch (error) {
      caja.textContent = mensajeError(error);
      boton.disabled = false;
      boton.textContent = "Entrar";
    }
  });
  $("#olvide").addEventListener("click", pedirRecuperacion);
  $("#crear-cuenta").addEventListener("click", pedirCrearCuenta);
  // Si el enlace del correo falló o venció, se avisa aquí.
  if (estado.recuperacion) {
    $("#error-login").textContent = estado.recuperacion.texto ||
      "El enlace para cambiar la contraseña no es válido o venció. Pide uno nuevo.";
    estado.recuperacion = null;
  }
  $("#correo").focus();
}

function montarPanel() {
  $("#salir").addEventListener("click", async () => {
    await db.auth.signOut();
    location.hash = "#/hoy";
  });
  $("#perfil").addEventListener("click", pedirNombre);
  const selectorSede = $("#sede-actual");
  if (selectorSede) selectorSede.addEventListener("change", () => cambiarSede(selectorSede.value));
  // Celular: el menú se abre y se cierra con el botón ☰
  const lateral = $(".lateral"), botonMenuMovil = $("#menu-movil");
  botonMenuMovil.addEventListener("click", () => {
    const abierto = lateral.classList.toggle("abierta");
    botonMenuMovil.setAttribute("aria-expanded", String(abierto));
    botonMenuMovil.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
  });
  $("#buscador").addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    estado.busqueda = evento.target.value.trim();
    if (claveActual() === "clientes") montarPantalla("clientes");
    else location.hash = "#/clientes";
  });
}

function pintar() {
  cerrarMenu();
  cerrarCalendario();
  cerrarDialogo();
  cerrarDialogo("dialogo-ficha");
  const raiz = $("#raiz");
  if (!configurado || !db) {
    raiz.innerHTML = htmlConfiguracion();
    return;
  }
  // Llegó desde el enlace del correo: primero se pide la contraseña nueva.
  if (estado.recuperacion && estado.recuperacion.modo === "nueva" && estado.sesion) {
    raiz.innerHTML = htmlNuevaClave();
    montarNuevaClave();
    return;
  }
  const clave = claveActual();
  const meta = MENU.find((m) => m.clave === clave);

  if (!estado.sesion) {
    if (meta.publica) {
      raiz.innerHTML = htmlPublico();
      montarPantalla(clave);
    } else {
      raiz.innerHTML = htmlLogin();
      montarLogin();
    }
    return;
  }
  // Usuario sin negocio: DALU puede seguir a "Negocios"; los demás ven un aviso.
  if (!estado.negocio && !estado.sinRoles) {
    if (estado.esDalu) {
      if (clave !== "negocios") history.replaceState(null, "", location.pathname + location.search + "#/negocios");
      raiz.innerHTML = htmlPanel("negocios");
      montarPanel();
      montarPantalla("negocios");
    } else {
      raiz.innerHTML = htmlSinNegocio();
      $("#salir").addEventListener("click", () => db.auth.signOut());
    }
    return;
  }
  // Colaborador sin sedes asignadas: no tiene agenda que ver.
  if (estado.conSedes && !estado.sede && !esAdmin()) {
    raiz.innerHTML = `<main class="login"><div class="tarjeta">
      <h1>Aún no tienes sede asignada</h1>
      <p>Tu usuario está en <strong>${esc(nombreNegocio())}</strong>, pero todavía no tiene ninguna sede.
      Pide al administrador que te asigne una en <strong>Usuarios</strong>.</p>
      <button id="salir" class="btn">Cerrar sesión</button></div></main>`;
    $("#salir").addEventListener("click", () => db.auth.signOut());
    return;
  }
  // Secciones solo para administrador (Reportes, Usuarios), DALU (Negocios) o fuera del plan
  if (!puedeVer(meta)) {
    history.replaceState(null, "", location.pathname + location.search + "#/hoy");
    raiz.innerHTML = htmlPanel("hoy");
    montarPanel();
    montarPantalla("hoy");
    aviso(meta.soloDalu ? "Esa sección es solo para DALU."
      : !moduloActivo(meta.modulo) ? "Esa sección no está incluida en tu plan."
        : "Esa sección es solo para el administrador.", true);
    return;
  }
  raiz.innerHTML = htmlPanel(clave);
  montarPanel();
  montarPantalla(clave);
  if (estado.otroNegocio) avisarOtroNegocio();
}

// Tiene sesión en un negocio y abrió el enlace de OTRO: la base solo le muestra su propio negocio
// (no hay forma de ver datos ajenos); aquí se le explica y se le ofrece cambiar de cuenta.
function avisarOtroNegocio() {
  const otro = estado.otroNegocio;
  estado.otroNegocio = null;
  abrirDialogo(`<div>
    <h2>Este enlace es de ${esc(otro.nombre)}</h2>
    <p>Entraste con una cuenta de <strong>${esc(nombreNegocio())}</strong>, así que solo puedes ver ${esc(nombreNegocio())}.
    Para entrar a ${esc(otro.nombre)}, cierra sesión e inicia con tu cuenta de ese negocio.</p>
    <div class="acciones">
      <button type="button" class="btn alt" id="on-seguir">Seguir en ${esc(nombreNegocio())}</button>
      <button type="button" class="btn" id="on-salir">Cerrar sesión</button>
    </div></div>`);
  const seguir = () => {
    try { history.replaceState(null, "", `/${estado.negocio.slug}${location.hash}`); } catch (error) { /* sin cambios */ }
    cerrarDialogo();
  };
  $("#on-seguir").addEventListener("click", seguir);
  $("#on-salir").addEventListener("click", async () => { cerrarDialogo(); await db.auth.signOut(); });
}

/* ---------- Invitaciones: mensaje para enviar por WhatsApp o correo ---------- */
function mensajeInvitacion(correo, negocio) {
  const enlace = negocio && negocio.slug ? enlacePublico(negocio.slug) : location.origin + "/";
  return `¡Hola! Te invité a ${negocio ? negocio.nombre : NOMBRE_PRODUCTO} en ${NOMBRE_PRODUCTO}.
1. Entra a ${enlace}
2. Toca «¿Te invitaron? Crea tu cuenta».
3. Usa este correo: ${correo}`;
}
function abrirEnvioInvitacion(correo, negocio, titulo = "Envía la invitación") {
  const texto = mensajeInvitacion(correo, negocio);
  const asunto = `Invitación a ${negocio ? negocio.nombre : NOMBRE_PRODUCTO} en ${NOMBRE_PRODUCTO}`;
  abrirDialogo(`<div>
    <h2>${esc(titulo)}</h2>
    <p class="suave">El sistema no envía correos solo: compártele este mensaje a <strong>${esc(correo)}</strong>.</p>
    <pre class="mensaje-invitacion">${esc(texto)}</pre>
    <div class="acciones envio-invitacion">
      <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto)}">Enviar por WhatsApp</a>
      <a class="btn alt" href="mailto:${encodeURIComponent(correo)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}">Enviar por correo</a>
      <button type="button" class="btn alt" id="ei-copiar">Copiar mensaje</button>
      <button type="button" class="btn alt" id="ei-cerrar">Listo</button>
    </div></div>`);
  $("#ei-cerrar").addEventListener("click", () => cerrarDialogo());
  $("#ei-copiar").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(texto); aviso("Mensaje copiado."); } catch (error) { aviso("No se pudo copiar: selecciónalo y cópialo.", true); }
  });
}

/* ---------- Aviso de versión nueva ---------- */
// index.html carga los archivos con ?v=NÚMERO. Al publicar cambios se sube ese número;
// la página abierta lo revisa cada 5 minutos (y al volver a la pestaña) y ofrece recargar.
const VERSION_CARGADA = (() => {
  const script = document.querySelector('script[src*="app.js"]');
  const m = script && script.src.match(/[?&]v=([\w.-]+)/);
  return m ? m[1] : null;
})();
async function revisarVersionNueva() {
  if (!VERSION_CARGADA || document.hidden) return;
  try {
    const html = await fetch(`${location.origin}/index.html?buscar-version=${Date.now()}`, { cache: "no-store" }).then((r) => r.text());
    const m = html.match(/app\.js\?v=([\w.-]+)/);
    if (m && m[1] !== VERSION_CARGADA) {
      aviso("Hay una versión nueva del sistema.", false, { texto: "Recargar", alHacer: () => location.reload() });
    }
  } catch (error) { /* sin internet: se revisa en la próxima vuelta */ }
}

// Rol y negocio de quien entró (o del visitante), su logo y el título de la pestaña.
async function prepararNegocio() {
  estado.otroNegocio = null;
  if (estado.sesion) {
    await cargarRol();
    await cargarSedes();
    const pedido = negocioPedido();
    if (pedido && estado.negocio && estado.negocio.slug && pedido !== estado.negocio.slug) {
      let nombre = pedido;
      try {
        const { data } = await db.from("negocios").select("nombre").eq("slug", pedido).maybeSingle();
        if (data) nombre = data.nombre;
      } catch (error) { /* se muestra la dirección corta */ }
      estado.otroNegocio = { slug: pedido, nombre };
    } else if (pedido) {
      direccionBonita(pedido);
    }
  } else { estado.rol = null; estado.esDalu = false; await cargarNegocioVisitante(); }
  // El logo se busca antes de dibujar (máximo 2,5 segundos de espera).
  await Promise.race([cargarLogo(), new Promise((resolver) => setTimeout(resolver, 2500))]);
  document.title = estado.negocio ? `${nombreNegocio()} · ${NOMBRE_PRODUCTO}` : NOMBRE_PRODUCTO;
}

/* ---------- Arranque (se llama desde index.html al final) ---------- */
async function iniciar() {
  document.title = NOMBRE_PRODUCTO;
  vigilarFechas();
  if (configurado && db) {
    try {
      const { data } = await db.auth.getSession();
      estado.sesion = data.session;
      estado.usuarioId = data.session ? data.session.user.id : null;
      await prepararNegocio();
    } catch (error) {
      aviso(mensajeError(error), true);
    }
    // Se limpia el enlace del correo de la barra de direcciones (ya lo leyó Supabase).
    if (RECUPERACION) history.replaceState(null, "", location.pathname + location.search + "#/hoy");
    db.auth.onAuthStateChange((evento, sesion) => {
      const nuevoId = sesion ? sesion.user.id : null;
      estado.sesion = sesion;
      if (evento === "PASSWORD_RECOVERY") {
        estado.recuperacion = { modo: "nueva" };
        estado.usuarioId = nuevoId;
        setTimeout(async () => { await prepararNegocio(); pintar(); }, 0);
        return;
      }
      // Solo se vuelve a dibujar si entró o salió alguien (no al renovar el token).
      if (nuevoId !== estado.usuarioId) {
        estado.usuarioId = nuevoId;
        setTimeout(async () => { await prepararNegocio(); pintar(); }, 0);
      }
    });
  }
  window.addEventListener("hashchange", pintar);
  pintar();
  setInterval(revisarVersionNueva, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) revisarVersionNueva(); });
}