"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { trailVertexShader, trailFragmentShader } from "@/app/shaders/trail";

export type TrailOptions = {
  /** per-frame persistence of the trail (0..1, higher = longer tail) */
  decay?: number;
  /** brush radius in aspect-corrected screen units (0..1) */
  radius?: number;
  /** how quickly the smoothed cursor chases the real cursor (0..1) */
  ease?: number;
  /** resolution scale of the offscreen buffer relative to the canvas */
  resolution?: number;
  /** enable the autonomous random-pulse reveal (independent of the cursor) */
  auto?: boolean;
  /** brush radius of the wanderer */
  autoRadius?: number;
  /** seconds a pulse stays lit before it is left to fade */
  autoShow?: number;
  /** seconds to wait (fading) before popping at a new random place */
  autoGap?: number;
};

/**
 * Owns a ping-pong FBO that accumulates a screen-space "reveal mask" from the
 * cursor. Returns a ref whose `.current` is always the latest mask texture.
 *
 * The update runs in a useFrame registered by the component that calls this
 * hook — because that component mounts before its children, the mask is fresh
 * by the time relief meshes read it.
 */
export function useCursorTrail({
  decay = 0.95,
  radius = 0.13,
  ease = 0.12,
  resolution = 0.5,
  auto = true,
  autoRadius = 0.16,
  autoShow = 0.8,
  autoGap = 0.5,
}: TrailOptions = {}) {
  const { gl, size } = useThree();

  // offscreen scene: one fullscreen quad rendered with the trail shader
  const { scene, camera, material, makeTarget } = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const material = new THREE.ShaderMaterial({
      vertexShader: trailVertexShader,
      fragmentShader: trailFragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uPrev: { value: null },
        uAspect: { value: 1 },
        uDecay: { value: decay },
        uClear: { value: 0.004 },
        uStrength: { value: 1 },
        // brush A — real cursor
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uMousePrev: { value: new THREE.Vector2(0.5, 0.5) },
        uRadius: { value: radius },
        uMouseOn: { value: 0 },
        uSpeedBoost: { value: 0 },
        // brush B — autonomous wanderer
        uAuto: { value: new THREE.Vector2(0.5, 0.5) },
        uAutoPrev: { value: new THREE.Vector2(0.5, 0.5) },
        uAutoRadius: { value: autoRadius },
        uAutoOn: { value: auto ? 1 : 0 },
      },
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    scene.add(quad);

    // 8-bit (UnsignedByte) so the texture can be sampled in the vertex shader
    // on all GPUs — half-float vertex texture fetch is not universally supported.
    const makeTarget = (w: number, h: number) =>
      new THREE.WebGLRenderTarget(w, h, {
        type: THREE.UnsignedByteType,
        depthBuffer: false,
        stencilBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
      });

    return { scene, camera, material, makeTarget };
  }, [decay, radius, autoRadius, auto]);

  // ping-pong render targets, recreated on resize
  const targets = useRef<{
    read: THREE.WebGLRenderTarget;
    write: THREE.WebGLRenderTarget;
  } | null>(null);

  const textureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    const w = Math.max(2, Math.floor(size.width * resolution));
    const h = Math.max(2, Math.floor(size.height * resolution));
    const read = makeTarget(w, h);
    const write = makeTarget(w, h);
    targets.current = { read, write };
    textureRef.current = read.texture;
    material.uniforms.uAspect.value = size.width / size.height;
    return () => {
      read.dispose();
      write.dispose();
    };
  }, [size.width, size.height, resolution, makeTarget, material]);

  // real cursor tracking (texture space: origin bottom-left)
  const target = useRef(new THREE.Vector2(0.5, 0.5));
  const smoothed = useRef(new THREE.Vector2(0.5, 0.5));
  const prevSmoothed = useRef(new THREE.Vector2(0.5, 0.5));
  const pointerSeen = useRef(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
      if (!pointerSeen.current) {
        // jump the smoothed cursor to the entry point so it doesn't streak in
        smoothed.current.copy(target.current);
        prevSmoothed.current.copy(target.current);
        pointerSeen.current = true;
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // autonomous reveal — sweeps along a short random stroke (like a cursor move),
  // leaving a trail, then fades and starts a fresh stroke somewhere else.
  const autoFrom = useRef(new THREE.Vector2(0.5, 0.5));
  const autoTo = useRef(new THREE.Vector2(0.5, 0.5));
  const autoCur = useRef(new THREE.Vector2(0.5, 0.5));
  const autoPrev = useRef(new THREE.Vector2(0.5, 0.5));
  const autoStart = useRef(-999);

  useFrame((state, delta) => {
    const t = targets.current;
    if (!t) return;

    // normalise to a 60fps step so behaviour is identical at any frame rate
    const step = Math.min(delta, 1 / 20) * 60;
    const easeF = 1 - Math.pow(1 - ease, step);
    const decayF = Math.pow(decay, step);

    // --- brush A: real cursor ---
    prevSmoothed.current.copy(smoothed.current);
    smoothed.current.lerp(target.current, easeF);
    const speed = prevSmoothed.current.distanceTo(smoothed.current);

    // --- brush B: random moving pulse ---
    // Sweep from a random start to a random nearby end over `autoShow` (painting
    // a trail like a cursor), then stop so the decay fades it; after
    // `autoShow + autoGap` pick a fresh stroke elsewhere.
    const now = state.clock.elapsedTime;
    let el = now - autoStart.current;
    if (el > autoShow + autoGap) {
      const ax = 0.14 + Math.random() * 0.72;
      const ay = 0.24 + Math.random() * 0.52;
      const ang = Math.random() * Math.PI * 2;
      const len = 0.2 + Math.random() * 0.22;
      autoFrom.current.set(ax, ay);
      autoTo.current.set(
        Math.min(0.86, Math.max(0.14, ax + Math.cos(ang) * len)),
        Math.min(0.78, Math.max(0.22, ay + Math.sin(ang) * len)),
      );
      autoCur.current.copy(autoFrom.current);
      autoPrev.current.copy(autoFrom.current);
      autoStart.current = now;
      el = 0;
    }
    const p = Math.min(el / autoShow, 1);
    const ep = p * p * (3 - 2 * p); // ease the travel
    autoPrev.current.copy(autoCur.current);
    autoCur.current.copy(autoFrom.current).lerp(autoTo.current, ep);
    const autoEnv = el < autoShow ? Math.min(el / 0.12, 1) : 0;

    material.uniforms.uDecay.value = decayF;
    material.uniforms.uPrev.value = t.read.texture;
    material.uniforms.uMouse.value.copy(smoothed.current);
    material.uniforms.uMousePrev.value.copy(prevSmoothed.current);
    material.uniforms.uMouseOn.value = pointerSeen.current ? 1 : 0;
    material.uniforms.uSpeedBoost.value = Math.min(speed * 12, 1.5);
    material.uniforms.uAuto.value.copy(autoCur.current);
    material.uniforms.uAutoPrev.value.copy(autoPrev.current);
    if (auto) material.uniforms.uAutoOn.value = autoEnv;

    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(t.write);
    gl.render(scene, camera);
    gl.setRenderTarget(prevTarget);

    // swap
    const tmp = t.read;
    t.read = t.write;
    t.write = tmp;
    textureRef.current = t.read.texture;
  });

  return textureRef;
}
