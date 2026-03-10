/**
 * Discord: webhook (canal interno pedidos-web) y creación de ticket (bot).
 * Variables: DISCORD_WEBHOOK_URL, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_CATEGORY_ID.
 */

/**
 * Envía un mensaje al canal interno (#pedidos-web) vía webhook.
 */
export async function sendToInternalChannel(content) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.startsWith("https://")) {
    throw new Error("DISCORD_WEBHOOK_URL no configurada");
  }
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook: ${res.status} ${text}`);
  }
}

/**
 * Crea un canal de ticket en el servidor y envía el mensaje inicial.
 * Requiere DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_CATEGORY_ID.
 * Devuelve { channelId } o null si falta config.
 */
export async function createTicketChannel(order) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const categoryId = process.env.DISCORD_CATEGORY_ID;
  if (!token || !guildId || !categoryId) {
    console.warn("Discord ticket: faltan BOT_TOKEN, GUILD_ID o CATEGORY_ID");
    return null;
  }

  const channelName = `ticket-${(order.order_id || "").toLowerCase().replace(/\s/g, "-")}`.slice(0, 100);
  const createRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify({
      name: channelName,
      type: 0,
      parent_id: categoryId,
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("Discord create channel:", createRes.status, err);
    return null;
  }
  const channel = await createRes.json();
  const channelId = channel.id;

  const mention = order.customer_discord_id ? `<@${order.customer_discord_id}>` : (order.customer_discord || "—");
  const content = [
    "**Nueva compra registrada**",
    "",
    `Order ID: ${order.order_id || "—"}`,
    `Producto: ${order.product_name || "—"}`,
    `Cantidad: ${order.quantity ?? "—"}`,
    `Total: ${order.total ?? "—"} USD`,
    `Método de pago: ${order.payment_method || "—"}`,
    `Email: ${order.customer_email || "—"}`,
    `Discord: ${mention}`,
    "",
    "**Cliente, envía ahora:**",
    "Correo Rockstar:",
    "Contraseña Rockstar:",
    "",
    "Usuario Steam:",
    "Contraseña Steam:",
    "",
    "Información adicional:",
    "(detalles personalizados, versión del juego, etc.)",
  ].join("\n");

  const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify({ content }),
  });
  if (!msgRes.ok) {
    console.error("Discord ticket message:", await msgRes.text());
  }
  return { channelId };
}

export function formatInternalMessage(order) {
  const discordLine = order.customer_discord || "—";
  const discordIdPart = order.customer_discord_id ? ` | ID: ${order.customer_discord_id}` : "";
  const lines = [
    "**PHANTOM PROJECT - NUEVA COMPRA**",
    "",
    `Order ID: ${order.order_id || "—"}`,
    `**Cliente:**`,
    `Email: ${order.customer_email || "—"}`,
    `Discord: ${discordLine}${discordIdPart}`,
    "",
    `Producto: ${order.product_name || "—"}`,
    `Cantidad: ${order.quantity ?? "—"}`,
    `Total: ${order.total ?? "—"} USD`,
    `Método de pago: ${order.payment_method || "—"}`,
    `Estado: ${order.payment_status || "paid"}`,
    "",
    "**Detalles:**",
    `- Dinero: ${order.selected_money || "—"}`,
    `- Nivel: ${order.selected_level || "—"}`,
    `- Vehículos: ${order.selected_vehicles || "—"}`,
    "",
    "Cliente, abre ticket en Discord y envía tus datos usando este ID del pedido."
  ];
  return lines.join("\n");
}
