/**
 * GET /api/order?order_id=PP-xxxxx
 * Devuelve el pedido para mostrarlo en success.html.
 * Solo devuelve si existe; el frontend puede ocultar datos sensibles si quiere.
 */

import { ordersTable } from "./lib/supabase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(404).json({ error: "Not found" });

  const orderId = req.query.order_id && String(req.query.order_id).trim();
  if (!orderId) return res.status(400).json({ error: "Falta order_id" });

  try {
    const table = ordersTable();
    const { data, error } = await table
      .select("order_id, product_name, product_price, quantity, total, payment_status, customer_email, customer_discord, product_image, product_type, selected_money, selected_level, selected_vehicles, payment_method, paid_at, email_sent")
      .eq("order_id", orderId)
      .single();
    if (error || !data) return res.status(404).json({ error: "Pedido no encontrado" });
    return res.status(200).json(data);
  } catch (e) {
    console.error("order get:", e);
    return res.status(503).json({ error: "Error al consultar pedido" });
  }
}
