"use client";

import { useEffect, useRef, useCallback } from "react";
import "./BackgroundAnimated.css";

const PARALLAX_STRENGTH = 0.025;
const SCROLL_PARALLAX = 0.03;
const MOUSE_THROTTLE_MS = 32;
const NODE_COUNT = 48;
const PARTICLE_COUNT = 120;
const LINE_DIST = 140;
const NODE_OPACITY = 0.12;
const LINE_OPACITY = 0.1;
const PARTICLE_OPACITY = 0.15;
const ORB_COUNT = 8;

const rand = (min, max) => min + Math.random() * (max - min);

const orbVariants = [
  "bg-[radial-gradient(circle_at_30%_30%,rgba(124,58,237,0.5),transparent_70%)]",
  "bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.4),transparent_70%)]",
  "bg-[radial-gradient(circle_at_30%_30%,rgba(139,92,246,0.4),transparent_70%)]",
  "bg-[radial-gradient(circle_at_30%_30%,rgba(124,58,237,0.35),transparent_70%)]",
  "bg-[radial-gradient(circle_at_30%_30%,rgba(79,70,229,0.35),transparent_70%)]",
  "bg-[radial-gradient(circle_at_30%_30%,rgba(139,92,246,0.3),transparent_70%)]",
  "bg-[radial-gradient(circle_at_30%_30%,rgba(124,58,237,0.4),transparent_70%)]",
  "bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.3),transparent_70%)]",
];

export default function BackgroundAnimated({ className = "" }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const orbsRef = useRef(null);
  const rafId = useRef(null);
  const nodesRef = useRef([]);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 });
  const scrollYRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const orbWrapsRef = useRef([]);

  const prefersReducedMotion = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : true;

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !sizeRef.current.w) return;

    const { w, h } = sizeRef.current;
    const nodes = nodesRef.current;
    const particles = particlesRef.current;

    ctx.clearRect(0, 0, w, h);

    if (!prefersReducedMotion) {
      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.x = Math.max(0, Math.min(w, n.x));
        n.y = Math.max(0, Math.min(h, n.y));
      });
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -5) p.y = h + 5;
        if (p.y > h + 5) p.y = -5;
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
      });
    }

    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < LINE_DIST) {
          const alpha = (1 - d / LINE_DIST) * LINE_OPACITY;
          ctx.strokeStyle = `rgba(165, 140, 255, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    nodes.forEach((n) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(200, 180, 255, ${NODE_OPACITY})`;
      ctx.arc(n.x, n.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    });

    particles.forEach((p) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(220, 210, 255, ${p.a})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    rafId.current = requestAnimationFrame(drawFrame);
  }, [prefersReducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const orbsContainer = orbsRef.current;
    if (!canvas || !orbsContainer) return;

    const DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    let w = window.innerWidth;
    let h = window.innerHeight;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      sizeRef.current = { w, h };
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(DPR, 0, 0, DPR, 0, 0);

      nodesRef.current = Array.from({ length: NODE_COUNT }, () => ({
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-0.08, 0.08),
        vy: rand(-0.05, 0.08),
      }));
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-0.15, 0.15),
        vy: rand(-0.1, 0.2),
        r: rand(0.8, 1.5),
        a: rand(0.06, PARTICLE_OPACITY),
      }));
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });

    if (prefersReducedMotion) {
      drawFrame();
    } else {
      rafId.current = requestAnimationFrame(drawFrame);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [drawFrame, prefersReducedMotion]);

  // Orbes: crear divs y parallax
  useEffect(() => {
    const orbsContainer = orbsRef.current;
    if (!orbsContainer) return;

    const floatClasses = ["bg-orb-float", "bg-orb-float-slow", "bg-orb-float-slower"];
    const wraps = [];
    for (let i = 0; i < ORB_COUNT; i++) {
      const size = Math.floor(rand(70, 180));
      const wrap = document.createElement("div");
      wrap.className = "absolute will-change-transform";
      wrap.style.left = rand(5, 85) + "%";
      wrap.style.top = rand(10, 80) + "%";
      wrap.style.transform = "translate(-50%, -50%)";
      const orb = document.createElement("div");
      orb.className = `rounded-full blur-[60px] opacity-[0.35] mix-blend-screen ${orbVariants[i]} ${floatClasses[i % 3]}`;
      orb.style.width = size + "px";
      orb.style.height = size + "px";
      wrap.appendChild(orb);
      orbsContainer.appendChild(wrap);
      wraps.push(wrap);
    }
    orbWrapsRef.current = wraps;

    let lastMouse = 0;
    function onMouseMove(e) {
      const t = performance.now();
      if (t - lastMouse < MOUSE_THROTTLE_MS) return;
      lastMouse = t;
      const W = sizeRef.current.w || window.innerWidth;
      const H = sizeRef.current.h || window.innerHeight;
      mouseRef.current.targetX = e.clientX / W;
      mouseRef.current.targetY = e.clientY / H;
    }
    function onScroll() {
      scrollYRef.current = window.scrollY ?? document.documentElement.scrollTop;
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    function tickParallax() {
      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.08;
      m.y += (m.targetY - m.y) * 0.08;
      const { w, h } = sizeRef.current;
      if (!w || !h) {
        requestAnimationFrame(tickParallax);
        return;
      }
      const moveX = (m.x * w - w / 2) * PARALLAX_STRENGTH;
      const moveY = (m.y * h - h / 2) * PARALLAX_STRENGTH;
      const scrollOff = scrollYRef.current * SCROLL_PARALLAX;
      wraps.forEach((wrap, i) => {
        const sign = i % 2 === 0 ? 1 : -1;
        const tx = moveX * (0.5 + (i % 3) * 0.3) * sign;
        const ty = moveY * (0.5 + (i % 2) * 0.4) + scrollOff * 0.5;
        wrap.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
      });
      requestAnimationFrame(tickParallax);
    }
    const parallaxId = requestAnimationFrame(tickParallax);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(parallaxId);
      wraps.forEach((w) => w.remove());
      orbWrapsRef.current = [];
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`fixed inset-0 -z-10 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Capa 1: base + viñeta */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #0a0614 0%, #0f0a1a 35%, #151020 70%, #0d0818 100%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Capa 2+4: canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" width={1} height={1} />

      {/* Capa 3: orbes (se inyectan en useEffect) */}
      <div ref={orbsRef} className="absolute inset-0 pointer-events-none" />
    </div>
  );
}
