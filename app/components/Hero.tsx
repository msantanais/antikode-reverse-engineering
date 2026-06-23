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
      <HeroScene relief="bird" isArise />

      {/* overlay UI — let pointer events fall through to the canvas/window */}
      <div className="pointer-events-none absolute inset-0 z-10 select-none">
        {/* top bar */}
        {/* <header className="absolute inset-x-0 top-0 flex items-center justify-between px-8 py-7 text-[13px] tracking-wide md:px-12">
          <span className="font-serif text-base tracking-[0.18em]">
            IG
          </span>
          <nav className="pointer-events-auto">
            <a href="#about" className="transition-opacity hover:opacity-60">
              About
            </a>
          </nav>
        </header> */}

        {/* centre line: logo · title · scroll */}
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-8 md:px-12">
          <div className="flex items-center gap-3">
            <Mark />
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

        {/* bottom bar */}
        {/* <footer className="absolute inset-x-0 bottom-0 flex items-end justify-between px-8 py-7 text-[13px] tracking-wide md:px-12">
          <a
            href="#projects"
            className="pointer-events-auto flex items-center gap-2 transition-opacity hover:opacity-60"
          >
            See all projects
            <BirdGlyph />
          </a>
          <ScrollCue />
        </footer> */}
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

function Mark() {
  return (
    <svg width="26" height="30" viewBox="0 0 26 30" fill="none" aria-hidden>
      <path
        d="M13 1 L25 7.5 V22.5 L13 29 L1 22.5 V7.5 Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
      <path d="M13 9 V21 M8.5 12 H17.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function BirdGlyph() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden>
      <path
        d="M1 7 C5 3 8 3 10 7 C12 3 15 3 19 7"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScrollCue() {
  return (
    <svg width="46" height="16" viewBox="0 0 46 16" fill="none" aria-hidden>
      <path
        d="M2 2 C14 14 32 14 44 2"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
