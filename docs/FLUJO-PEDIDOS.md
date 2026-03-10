# Flujo de pedidos — Phantom Project

## 1. Variables que tenés que configurar

En **Vercel** → proyecto → **Settings** → **Environment Variables**:

| Variable | Uso |
|----------|-----|
| `SUPABASE_URL` | URL del proyecto en Supabase (Dashboard → Settings → API). |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave "service_role" de Supabase (Dashboard → Settings → API). **No** uses la anon key. |
| `DISCORD_WEBHOOK_URL` | Webhook del canal **#pedidos-web** (interno). Crear en Discord: canal → Editar → Integraciones → Webhooks. |
| `DISCORD_BOT_TOKEN` | Token del bot que crea los tickets. Crear app en Discord Developer Portal → Bot → Reset Token. |
| `DISCORD_GUILD_ID` | ID del servidor de Discord. Activar modo desarrollador → clic derecho al servidor → Copiar ID. |
| `DISCORD_CATEGORY_ID` | ID de la categoría donde se crearán los canales de ticket. Clic derecho a la categoría → Copiar ID. |
| `RESEND_API_KEY` | API Key de [Resend](https://resend.com). Dominio verificado para `EMAIL_FROM_ADDRESS`. |
| `EMAIL_FROM_ADDRESS` | Email remitente (ej. `notificaciones@tudominio.com`). Debe estar verificado en Resend. |

PayPal y NOWPayments siguen configurados en `checkout.js` / `checkout.html` como hasta ahora.

---

## 2. IDs de Discord que tenés que sacar

1. **Guild ID (servidor)**  
   Discord → Configuración del usuario → Modo desarrollador: ON. Clic derecho sobre tu servidor → **Copiar ID del servidor**. Ese valor es `DISCORD_GUILD_ID`.

2. **Category ID (categoría para tickets)**  
   Clic derecho sobre la categoría donde quieras que se creen los canales tipo `ticket-pp-483921` → **Copiar ID**. Ese valor es `DISCORD_CATEGORY_ID`.

3. **Bot token**  
   [Discord Developer Portal](https://discord.com/developers/applications) → tu aplicación → Bot → **Reset Token**. Ese valor es `DISCORD_BOT_TOKEN`. El bot debe estar invitado al servidor con permisos **Gestionar canales** y **Enviar mensajes**.

4. **Webhook del canal #pedidos-web**  
   En el canal #pedidos-web: Editar canal → Integraciones → Webhooks → Nuevo webhook. Copiar la URL del webhook. Ese valor es `DISCORD_WEBHOOK_URL`. El cliente **no** ve este canal; es solo para vos y staff.

---

## 3. Cómo probar el flujo sin romper lo actual

1. **Supabase**  
   En el SQL Editor de Supabase, ejecutá el contenido de `supabase/orders_table.sql` para crear la tabla `orders`.

2. **Variables**  
   Mientras no tengas todas las variables (Resend, bot de Discord, etc.), el flujo sigue funcionando:  
   - Checkout y pago (PayPal/Crypto) no cambian.  
   - Si faltan `SUPABASE_*`, `/api/create-order` y `/api/confirm-payment` devolverán error o 503; el front guarda todo en localStorage y redirige a success igual.  
   - Si Supabase está bien pero falta el bot de Discord, el pedido se marca como paid y se envía el mensaje al webhook #pedidos-web, pero **no** se crea el canal de ticket.  
   - Si falta Resend, no se envía el email; el resto del flujo es igual.

3. **Probar solo Supabase**  
   Configurá solo `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Hacé una compra de prueba. En Supabase → Table Editor → `orders` deberías ver el pedido primero con `payment_status = pending` y, después de pasar por success, con `payment_status = paid` (por la llamada a `/api/confirm-payment`).

4. **Mencionar al cliente en el ticket**  
   Si el cliente pone su **Discord User ID** en el checkout (campo opcional), en el mensaje del ticket se usa `<@USER_ID>` y Discord lo convierte en mención. Si solo pone username, se guarda y se muestra como texto; no se puede mencionar sin el ID.

---

## 4. Resumen del flujo

1. Cliente llena checkout (email, Discord, etc.) y paga con PayPal o Crypto.  
2. Antes de abrir PayPal/Crypto, el front llama a **POST /api/create-order** y crea el pedido en Supabase con `payment_status = 'pending'`.  
3. Tras el pago, el cliente llega a **success.html**. Esa página llama a **POST /api/confirm-payment** con `order_id`, `payment_method` y, si aplica, `paypal_order_id` o `crypto_invoice_id`.  
4. El backend marca el pedido como **paid**, envía el mensaje al webhook #pedidos-web (una sola vez), crea el canal de ticket (una sola vez) y envía el email (una sola vez), usando los flags en Supabase para no duplicar.  
5. Success muestra el pedido (desde **GET /api/order** si hay backend; si no, desde localStorage) y, si el backend marcó `email_sent`, el texto "Te enviamos una confirmación por email".
