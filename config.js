// ---------- Bases de datos: producción y pruebas ----------
// En vital.dalu.pro (el sitio publicado) se usa SIEMPRE la base de producción.
// En cualquier otra dirección (tu computador: localhost, 127.0.0.1, archivo…) se usa la de pruebas,
// así lo que pruebes nunca toca los datos reales de los negocios.
const BASES = {
  produccion: {
    url: "https://hkzaxvijtomwhzmvyqkq.supabase.co",
    clave: "sb_publishable_3ljuZK8TC8p2gPDqMRR5Ow_irEkQdcZ",
  },
  pruebas: {
    // Supabase → proyecto de pruebas → Project Settings → API (Project URL y la clave publishable)
    url: "https://fejdjrnocouxjhjkjrgo.supabase.co",
    clave: "sb_publishable__hyJSi_ulS71uvn0KZqkYA_ynZFSVVr",
  },
};
const ENTORNO = /(^|\.)dalu\.pro$/i.test(location.hostname) ? "produccion" : "pruebas";
const SUPABASE_URL = BASES[ENTORNO].url;
const SUPABASE_ANON_KEY = BASES[ENTORNO].clave;

// Fuera de producción todo avisa que es la BASE DE PRUEBAS, para no confundirse:
//   - una franja roja fija arriba en todas las pantallas,
//   - la pestaña del navegador empieza con "🧪 PRUEBAS".
// (En las pruebas automáticas no se muestra, para no cambiar lo que miden.)
if (ENTORNO === "pruebas" && !navigator.webdriver) {
  document.addEventListener("DOMContentLoaded", () => {
    const franja = document.createElement("div");
    franja.id = "franja-pruebas";
    franja.innerHTML = "🧪 BASE DE PRUEBAS<span class=\"franja-detalle\"> · los cambios no afectan a los negocios reales</span>";
    franja.setAttribute("role", "note");
    franja.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;padding:3px 8px;text-align:center;" +
      "background:#B3261E;color:#fff;font:700 12px/18px system-ui,sans-serif;letter-spacing:.02em;pointer-events:none;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
    document.body.appendChild(franja);
    // Se corre todo 24 px hacia abajo para que la franja no tape el menú ni la entrada.
    const estilo = document.createElement("style");
    estilo.textContent = "body{padding-top:24px}.acceso{top:24px}.lateral{top:24px}" +
      "@media (min-width:861px){.lateral{height:calc(100vh - 24px)}}@media (max-width:600px){.franja-detalle{display:none}}";
    document.head.appendChild(estilo);
    // La app cambia el título al cargar cada negocio: se le antepone "🧪 PRUEBAS" siempre.
    const marcarTitulo = () => {
      if (!document.title.startsWith("🧪 PRUEBAS")) document.title = "🧪 PRUEBAS · " + document.title;
    };
    marcarTitulo();
    new MutationObserver(marcarTitulo).observe(document.querySelector("title"), { childList: true });
  });
}

// Negocio que se muestra sin sesión cuando la dirección no trae ?negocio=... (entrada y videos públicos).
// El nombre y el logo de cada negocio vienen de la base de datos (tabla "negocios").
const NEGOCIO_POR_DEFECTO = "petgarden";
// Solo se usa si la base todavía no tiene el SQL v11 (un solo negocio).
const NOMBRE_NEGOCIO = "Pet Garden";
// DALU: WhatsApp para mejorar el plan o avisar un pago, y medios de pago que ve el administrador en "Suscripción".
const DALU_WHATSAPP = "3223050787";
const DALU_MEDIOS_PAGO = [
  { nombre: "Nequi", numero: "311 212 1501" },
  { nombre: "Daviplata", numero: "311 212 1501" },
];
