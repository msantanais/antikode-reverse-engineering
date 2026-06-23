"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";

// WebGL must only run on the client.
const HeroScene = dynamic(() => import("@/app/components/HeroScene"), {
  ssr: false,
});

export default function Hero() {
  return (
    <section className="relative h-dvh w-full overflow-hidden bg-[#e9e7e2] text-neutral-800">
      {/* omit bgColor to use the plaster texture instead */}
      <HeroScene relief="bird" isArise bgColor="#e8e8e8" />

      {/* overlay UI — let pointer events fall through to the canvas/window */}
      <div className="pointer-events-none absolute inset-0 z-10 select-none">
        {/* centre line: logo · title · scroll */}
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-8 md:px-12">
          <div className="flex items-center gap-3">
            <span className="font-serif text-sm tracking-[0.32em]">
              IMMERSIVE&nbsp;GARDEN
            </span>
          </div>

          <h1 className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-serif text-[28px] font-medium leading-none tracking-tight md:text-[40px]">
            Innovative digital experiences studio
          </h1>

          <span className="hidden text-[13px] tracking-wide text-neutral-500 md:inline">
            Scroll down
          </span>
        </div>
      </div>

      <CursorDot />
    </section>
  );
}

function CursorDot() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      el.style.opacity = "1";
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return (
    <div
      ref={ref}
      className="pointer-events-none fixed left-0 top-0 z-20 h-1.5 w-1.5 rounded-full bg-neutral-700 opacity-0 mix-blend-difference"
      style={{ willChange: "transform" }}
    />
  );
}