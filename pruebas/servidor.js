// Servidor mínimo (sin instalar nada) para abrir el sitio durante las pruebas.
// Uso: node pruebas/servidor.js  → http://localhost:8765
const http = require("http");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const archivo = path.join(RAIZ, ruta === "/" ? "index.html" : ruta);
  if (!archivo.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  fs.readFile(archivo, (error, datos) => {
    if (error) {
      // Igual que GitHub Pages: si la dirección no existe (ej. /petgarden), se muestra 404.html.
      return fs.readFile(path.join(RAIZ, "404.html"), (e2, pagina) => {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end(e2 ? "No existe" : pagina);
      });
    }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(datos);
  });
}).listen(Number(process.env.PUERTO) || 8765);
