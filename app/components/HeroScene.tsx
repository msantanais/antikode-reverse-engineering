"use client";

import { useMemo, useRef, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

import { useCursorTrail } from "@/app/hooks/useCursorTrail";
import { Relief, type ReliefName } from "@/app/components/Relief";
import {
  plasterVertexShader,
  plasterFragmentShader,
} from "@/app/shaders/relief";

const PLASTER_URL = "/home/plaster.jpg";
const PLASTER_TILE = 1.4;
// neutral tint: keep the relief the same tone as the background
const GREY_TINT = new THREE.Color(1, 1, 1);

/** Parse "#rrggbb" into a raw (un-managed) sRGB 0..1 vec3, so it composites
 *  WYSIWYG in our raw ShaderMaterials (no colour-space conversion). */
function hexToRawVec(hex: string): THREE.Vector3 {
  const h = hex.replace("#", "");
  const f =
    h.length === 3
      ? h.split("").map((c) => parseInt(c + c, 16))
      : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((c) => parseInt(c, 16));
  return new THREE.Vector3(f[0] / 255, f[1] / 255, f[2] / 255);
}

/** Fullscreen background; either the plaster texture or a solid colour. */
function PlasterBackground({
  plaster,
  plasterScale,
  useColorBg,
  bgColor,
}: {
  plaster: THREE.Texture;
  plasterScale: THREE.Vector2;
  useColorBg: boolean;
  bgColor: THREE.Vector3;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: plasterVertexShader,
        fragmentShader: plasterFragmentShader,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uPlaster: { value: plaster },
          uPlasterScale: { value: plasterScale },
          uUseColor: { value: useColorBg ? 1 : 0 },
          uBgColor: { value: bgColor },
        },
      }),
    [plaster, plasterScale, useColorBg, bgColor],
  );

  return (
    <mesh material={material} renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

function Experience({
  relief,
  isWatery,
  isMagnifying,
  isArise,
  bgColor,
}: {
  relief: ReliefName;
  isWatery: boolean;
  isMagnifying: boolean;
  isArise: boolean;
  bgColor?: string;
}) {
  const { size } = useThree();

  const useColorBg = !!bgColor;
  const bgVec = useMemo(() => hexToRawVec(bgColor ?? "#000000"), [bgColor]);
  const trailRef = useCursorTrail({
    decay: 0.98,
    radius: 0.18,
    ease: 0.1,
    auto: true,
    autoRadius: 0.18,
    autoShow: 0.8,
    autoGap: 0.5,
  });

  // debug: ?reveal=1 forces a full reveal so the bare relief can be inspected
  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const revealFloor = params.has("reveal") ? Number(params.get("reveal")) : 0;
  const introFrom = params.has("reveal") ? 0 : 0.85;

  const plasterBase = useTexture(PLASTER_URL);
  const plaster = useMemo(() => {
    const t = plasterBase.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace; // raw composite, see Relief.tsx
    t.needsUpdate = true;
    return t;
  }, [plasterBase]);

  // keep the plaster tiling square regardless of viewport aspect
  const plasterScale = useMemo(
    () => new THREE.Vector2((size.width / size.height) * PLASTER_TILE, PLASTER_TILE),
    [size.width, size.height]
  );

  return (
    <>
      <PlasterBackground
        plaster={plaster}
        plasterScale={plasterScale}
        useColorBg={useColorBg}
        bgColor={bgVec}
      />
      <Suspense fallback={null}>
        <Relief
          name={relief}
          trailRef={trailRef}
          plaster={plaster}
          plasterScale={plasterScale}
          useColorBg={useColorBg}
          bgColor={bgVec}
          contrast={0.7}
          reveal={revealFloor}
          introFrom={introFrom}
          tint={GREY_TINT}
          emissiveWeight={0.6}
          mid={0.5}
          reliefStrength={0.8}
          shadow={0.55}
          highlight={0}
          isWatery={isWatery}
          isMagnifying={isMagnifying}
          magStrength={0.8}
          isArise={isArise}
          rise={0.4}
        />
      </Suspense>
    </>
  );
}

export default function HeroScene({
  relief = "bird",
  isWatery = false,
  isMagnifying = false,
  isArise = false,
  bgColor,
}: {
  relief?: ReliefName;
  isWatery?: boolean;
  isMagnifying?: boolean;
  isArise?: boolean;
  /** hex like "#2596be" to use a solid colour background; omit for plaster */
  bgColor?: string;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 20], fov: 30 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={[bgColor ?? "#e9e7e2"]} />
      <Suspense fallback={null}>
        <Experience
          relief={relief}
          isWatery={isWatery}
          isMagnifying={isMagnifying}
          isArise={isArise}
          bgColor={bgColor}
        />
      </Suspense>
    </Canvas>
  );
}
