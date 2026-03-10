/**
 * POST /api/create-order
 * Crea el pedido en Supabase con payment_status = 'pending'.
 * Se llama desde checkout antes de abrir PayPal/Crypto.
 * Body: order_id, product_name, product_price, quantity, total, customer_email, customer_discord, customer_discord_id?, product_image?, product_type?, selected_money?, selected_level?, selected_vehicles?
 */

import { ordersTable } from "./lib/supabase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(404).json({ error: "Not found" });

  try {
    const table = ordersTable();
  } catch (e) {
    console.error("Supabase no configurado:", e.message);
    return res.status(503).json({ error: "Servicio no configurado" });
  }

  const b = req.body || {};
  const orderId = b.order_id && String(b.order_id).trim();
  const customerEmail = b.customer_email && String(b.customer_email).trim();
  if (!orderId || !customerEmail) {
    return res.status(400).json({ error: "Faltan order_id o customer_email" });
  }

  const row = {
    order_id: orderId,
    product_name: b.product_name != null ? String(b.product_name) : "",
    product_price: Number(b.product_price) || 0,
    quantity: Math.max(1, Math.floor(Number(b.quantity)) || 1),
    total: Number(b.total) || 0,
    payment_method: b.payment_method ? String(b.payment_method) : null,
    payment_status: "pending",
    customer_email: customerEmail,
    customer_discord: b.customer_discord != null ? String(b.customer_discord) : null,
    customer_discord_id: b.customer_discord_id != null ? String(b.customer_discord_id).trim() || null : null,
    product_image: b.product_image != null ? String(b.product_image) : null,
    product_type: b.product_type != null ? String(b.product_type) : null,
    selected_money: b.selected_money != null ? String(b.selected_money) : null,
    selected_level: b.selected_level != null ? String(b.selected_level) : null,
    selected_vehicles: b.selected_vehicles != null ? String(b.selected_vehicles) : null,
    paypal_order_id: null,
    crypto_invoice_id: null,
    discord_notified: false,
    discord_ticket_created: false,
    email_sent: false,
  };

  try {
    const { data, error } = await ordersTable().insert(row).select("id, order_id").single();
    if (error) {
      if (error.code === "23505") return res.status(200).json({ ok: true, order_id: orderId });
      console.error("create-order insert:", error);
      return res.status(500).json({ error: error.message || "Error al crear pedido" });
    }
    return res.status(200).json({ ok: true, order_id: data?.order_id || orderId });
  } catch (err) {
    console.error("create-order:", err);
    return res.status(500).json({ error: err.message || "Error al crear pedido" });
  }
}
