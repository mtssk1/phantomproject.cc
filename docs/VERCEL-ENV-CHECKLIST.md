# Checklist: variables de entorno en Vercel

En **Vercel** → tu proyecto → **Settings** → **Environment Variables** revisá que existan estas variables para **Production** (y opcionalmente Preview si querés probar).

---

## Obligatorias (para que funcione el flujo completo)

| Variable | Dónde se usa | Qué poner |
|----------|--------------|-----------|
| **SUPABASE_URL** | `/api/create-order`, `/api/confirm-payment`, `/api/order` | URL de tu proyecto Supabase, ej. `https://xxxx.supabase.co` |
| **SUPABASE_SERVICE_ROLE_KEY** | Mismas APIs (lectura/escritura en tabla `orders`) | Clave "service_role" del proyecto en Supabase → Settings → API |
| **DISCORD_WEBHOOK_URL** | `/api/confirm-payment` → mensaje al canal al marcar pedido como pagado | URL del webhook del canal (ej. #pedidos-web), ej. `https://discord.com/api/webhooks/...` |

Sin estas tres, los pedidos no se guardan en Supabase y el mensaje no llega a Discord cuando alguien paga.

---

## Opcionales (mejoran el flujo)

| Variable | Dónde se usa | Qué poner |
|----------|--------------|-----------|
| **DISCORD_BOT_TOKEN** | Crear canal de ticket por pedido | Token del bot de Discord (Developer Portal) |
| **DISCORD_GUILD_ID** | Id del servidor donde crear el ticket | ID del servidor de Discord |
| **DISCORD_CATEGORY_ID** | Categoría donde crear el canal ticket | ID de la categoría de canales para tickets |
| **RESEND_API_KEY** | Enviar email de confirmación al cliente | API Key de Resend |
| **EMAIL_FROM_ADDRESS** | Remitente del email | Ej. `notificaciones@tudominio.com` o el que te asigne Resend |

Si no las ponés, el mensaje al webhook y el guardado en Supabase siguen funcionando; solo no se crea ticket automático ni email.

---

## No van en Vercel (están en el frontend)

- **PayPal Client ID**: ya está en `checkout.html` (script del SDK).
- **NOWPayments API Key**: está en `checkout.js` (creación de invoice desde el navegador). Si quisieras moverla al backend, habría que crear un endpoint que cree la invoice desde el servidor.

---

## Cómo verificar

1. Entrá a [vercel.com](https://vercel.com) → tu proyecto **phantomproject.cc**.
2. **Settings** → **Environment Variables**.
3. Comprobá que para **Production** existan al menos:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DISCORD_WEBHOOK_URL`
4. Después de agregar o cambiar variables, hace falta un **redeploy** (Deployments → ... → Redeploy) para que tomen efecto.
