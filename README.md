# Phantom Proyect Page

Landing estática (HTML/CSS/JS) con paleta **violeta / negro / blanco**, fondo animado y tarjetas clickeables que redirigen a Discord.

## Configurar tus links

Abrí `script.js` y cambiá:

- `LINKS.discord`: pegá tu invite o link directo a canal, por ejemplo `https://discord.gg/XXXX` o `https://discord.com/channels/SERVER_ID/CHANNEL_ID`
- `LINKS.youtube`: tu canal, por ejemplo `https://www.youtube.com/@TuCanal`

## Cómo abrir la web

- Doble click a `index.html` (funciona).
- Recomendado: levantar un servidor local (evita ciertos bloqueos del navegador):

```bash
python -m http.server 5500
```

Luego abrí `http://localhost:5500`.

## Despliegue en Vercel

1. Subí el proyecto a GitHub.
2. En [Vercel](https://vercel.com), importá el repositorio.
3. En **Settings → Environment Variables** agregá:
   - `DISCORD_WEBHOOK_URL` = tu URL del webhook de Discord (solo en el backend, no se expone en el frontend).
4. Desplegá. El frontend (HTML/JS/CSS) y el endpoint `/api/send-order-discord` funcionan en el mismo origen.

No hace falta `server.js` en Vercel; el webhook lo maneja la serverless function en `/api/send-order-discord.js`.

## Notificación a Discord (webhook)

Cuando un pedido llega a la página de éxito, se envía un mensaje automático al canal de Discord.

- **La URL del webhook no se expone en el frontend.** Solo se usa en el backend (variable de entorno `DISCORD_WEBHOOK_URL`).
- success.js llama a `POST /api/send-order-discord` con `orderId`, `productName`, `quantity`, `total`, `paymentMethod`.
- **Una sola vez por visita**: si el usuario refresca success, no se vuelve a enviar (`localStorage.discordNotified = "true"`). No se borran orderId ni datos del pedido.

### Backend local (opcional)

Si querés correr el backend en Node sin Vercel, usá `server.js` y la variable de entorno (ver `.env.example`).

