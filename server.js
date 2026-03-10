/**
 * Backend Node opcional — Phantom Project (notificación a Discord).
 *
 * EN VERCEL: No se usa este archivo. El webhook lo maneja la serverless function
 * en /api/send-order-discord.js. Configurá DISCORD_WEBHOOK_URL en Vercel.
 *
 * Este server.js solo sirve si querés correr un backend Node local (ej. node server.js).
 * La URL del webhook se usa solo vía variable de entorno, nunca en el frontend.
 */

const http = require("http");
const https = require("https");

const PORT = Number(process.env.PORT) || 3001;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

function sendOrderToDiscord(payload) {
  if (!DISCORD_WEBHOOK_URL) {
    return Promise.reject(new Error("DISCORD_WEBHOOK_URL no configurada"));
  }
  const { orderId, productName, quantity, total, paymentMethod } = payload;
  const content = [
    "**PHANTOM PROJECT - NUEVA COMPRA**",
    "",
    `Order ID: ${orderId || "—"}`,
    `Producto: ${productName || "—"}`,
    `Cantidad: ${quantity != null ? quantity : "—"}`,
    `Total: ${total != null ? total : "—"} USD`,
    `Método de pago: ${paymentMethod || "—"}`,
    "",
    "Cliente, abre ticket en Discord y envía tus datos usando este ID del pedido."
  ].join("\n");

  const body = JSON.stringify({ content });
  const url = new URL(DISCORD_WEBHOOK_URL);
  const isHttps = url.protocol === "https:";
  const request = isHttps ? https.request : http.request;

  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body, "utf8"),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve();
          else reject(new Error(data || `HTTP ${res.statusCode}`));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/api/send-order-discord") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(body || "{}");
    } catch (_) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Body JSON inválido" }));
      return;
    }

    sendOrderToDiscord(payload)
      .then(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      })
      .catch((err) => {
        console.error("Discord webhook error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || "Error al enviar a Discord" }));
      });
  });
});

server.listen(PORT, () => {
  console.log(`Phantom API escuchando en puerto ${PORT}`);
  if (!DISCORD_WEBHOOK_URL) console.warn("AVISO: DISCORD_WEBHOOK_URL no está definida. Definila para que el webhook funcione.");
});
