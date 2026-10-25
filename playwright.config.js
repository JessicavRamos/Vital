// Pruebas automáticas de la interfaz con Playwright.
// Correr:  npm install   (una sola vez)   y luego   npm test
// No usan tu base de datos real: Supabase se reemplaza por pruebas/supabase-falso.js.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./pruebas",
  timeout: 30000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "pruebas/reporte" }]],
  use: { baseURL: "http://localhost:8765", locale: "es-CO", timezoneId: "America/Bogota", trace: "retain-on-failure" },
  webServer: { command: "node pruebas/servidor.js", url: "http://localhost:8765/index.html", reuseExistingServer: true },
});
