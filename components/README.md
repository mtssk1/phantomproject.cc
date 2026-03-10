# BackgroundAnimated — Uso en React/Next.js

Componente de fondo animado en 4 capas (base, network + partículas en canvas, orbes con parallax). Pensado para layout con `position: fixed`, `inset: 0`, `z-index` bajo.

## Uso en Next.js (App Router)

1. Copiá `BackgroundAnimated.jsx` y `BackgroundAnimated.css` en tu proyecto (por ejemplo `components/BackgroundAnimated/`).

2. En tu layout o página:

```jsx
import BackgroundAnimated from "@/components/BackgroundAnimated";

export default function Layout({ children }) {
  return (
    <>
      <BackgroundAnimated />
      <div className="relative z-10">
        {children}
      </div>
    </>
  );
}
```

El contenido debe tener `z-10` (o mayor) para quedar por encima del fondo.

## Requisitos

- **Tailwind**: el componente usa clases de Tailwind (`rounded-full`, `blur-[60px]`, `opacity-[0.35]`, etc.). Asegurate de tener Tailwind configurado.
- **"use client"**: el componente ya incluye `"use client"` para Next.js App Router.
- **prefers-reduced-motion**: si el usuario tiene reducción de movimiento, las animaciones del canvas y orbes se desactivan (un frame estático en canvas, orbes sin animación CSS).

## Props

| Prop       | Tipo   | Descripción                          |
|-----------|--------|--------------------------------------|
| `className` | string | Clases adicionales para el wrapper (opcional). |

## Capas

1. **Base**: gradiente negro → violeta oscuro + viñeta.
2. **Network**: puntos y líneas tipo constelación en canvas, opacidad 0.08–0.15, drift lento.
3. **Orbes**: 8 blobs con blur/glow violeta/azul, flotación + rotación + parallax con mouse (1–3%) y scroll.
4. **Partículas**: partículas pequeñas (1–2px) en el mismo canvas, animación lenta.

Performance: `requestAnimationFrame`, throttling en `mousemove`, sin librerías pesadas.
