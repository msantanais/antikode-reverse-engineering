"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { reliefVertexShader, reliefFragmentShader } from "@/app/shaders/relief";

const GLB_URL = "/3d/reliefs_low_compressed.glb";

// node -> the world-space Y offset baked into the GLB (reliefs are stacked
// vertically). We recentre the chosen relief on the origin.
export const RELIEFS = {
  bird: "bird_01.029",
  deer: "deer_01.043",
  dragonflies: "dragonflies_01.023",
  frog: "frog_01.035",
  peacock: "peacock_v02.001",
  squirrel: "squirrel_01.015",
} as const;

export type ReliefName = keyof typeof RELIEFS;

type Props = {
  name?: ReliefName;
  trailRef: React.MutableRefObject<THREE.Texture | null>;
  plaster: THREE.Texture;
  plasterScale: THREE.Vector2;
  /** global reveal floor that always shows the relief a little */
  reveal?: number;
  tint?: THREE.Color;
  contrast?: number;
  /** one-shot intro: fade a global reveal from `introFrom` to 0 */
  introFrom?: number;
  introDuration?: number;
  /** shading controls (see relief fragment shader) */
  emissiveWeight?: number;
  mid?: number;
  reliefStrength?: number;
  shadow?: number;
  highlight?: number;
  /** >1 scales the relief to cover the viewport with a little margin */
  fill?: number;
  /** liquid/water look on the revealed area */
  isWatery?: boolean;
  liquidAmp?: number;
  liquidFreq?: number;
  liquidSpeed?: number;
  caustic?: number;
  /** magnifying-glass zoom on the revealed area */
  isMagnifying?: boolean;
  magStrength?: number;
  /** the relief physically rises toward the cursor where revealed */
  isArise?: boolean;
  rise?: number;
};

export function Relief({
  name = "bird",
  trailRef,
  plaster,
  plasterScale,
  reveal = 0,
  tint,
  contrast = 1.35,
  introFrom = 0.85,
  introDuration = 2.2,
  emissiveWeight = 0.6,
  mid = 0.5,
  reliefStrength = 1.7,
  shadow = 0.15,
  highlight = 0.12,
  fill = 1.05,
  isWatery = true,
  liquidAmp = 0.004,
  liquidFreq = 8,
  liquidSpeed = 0.85,
  caustic = 0.05,
  isMagnifying = false,
  magStrength = 0.6,
  isArise = false,
  rise = 2.2,
}: Props) {
  const gltf = useGLTF(GLB_URL, "/draco/");
  const viewport = useThree((s) => s.viewport);

  const { geometry, base, emissive, dims } = useMemo(() => {
    // node names in the GLB contain dots, which don't survive as clean keys.
    // Select the mesh by matching its material name to the relief instead.
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    const node =
      meshes.find((m) =>
        (m.material as THREE.Material)?.name?.toLowerCase().includes(name),
      ) ?? meshes[0];
    const mat = node.material as THREE.MeshStandardMaterial;

    const base = mat.map!;
    const emissive = mat.emissiveMap!;
    // Treat the baked maps as raw data: we composite + output in a raw
    // ShaderMaterial that does no colour-space re-encode, so any GPU sRGB decode
    // on sampling would darken the result. NoColorSpace = WYSIWYG with the source.
    for (const t of [base, emissive]) {
      t.colorSpace = THREE.NoColorSpace;
      t.flipY = false;
      t.needsUpdate = true;
    }

    // recentre the relief on the origin (strip the stacked Y offset)
    const geometry = node.geometry.clone();
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    const c = new THREE.Vector3();
    bb.getCenter(c);
    geometry.translate(-c.x, -c.y, 0);
    const dims = { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y };

    return { geometry, base, emissive, dims };
  }, [gltf, name]);

  // scale the relief to COVER the viewport (fills the screen, crops overflow)
  const scale = useMemo(() => {
    if (!viewport.width || !viewport.height) return 1;
    return Math.max(viewport.width / dims.w, viewport.height / dims.h) * fill;
  }, [viewport.width, viewport.height, dims, fill]);

  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const materialArgs = useMemo<[THREE.ShaderMaterialParameters]>(
    () => [
      {
        vertexShader: reliefVertexShader,
        fragmentShader: reliefFragmentShader,
        side: THREE.DoubleSide,
        uniforms: {
          uBase: { value: base },
          uEmissive: { value: emissive },
          uTrail: { value: null },
          uPlaster: { value: plaster },
          uPlasterScale: { value: plasterScale },
          uEmissiveWeight: { value: emissiveWeight },
          uMid: { value: mid },
          uReliefStrength: { value: reliefStrength },
          uShadow: { value: shadow },
          uHighlight: { value: highlight },
          uTint: { value: tint ?? new THREE.Color(1, 1, 1) },
          uReveal: { value: reveal },
          uContrast: { value: contrast },
          uTime: { value: 0 },
          uWateryOn: { value: isWatery ? 1 : 0 },
          uLiquidAmp: { value: liquidAmp },
          uLiquidFreq: { value: liquidFreq },
          uLiquidSpeed: { value: liquidSpeed },
          uCaustic: { value: caustic },
          uMagnify: { value: isMagnifying ? 1 : 0 },
          uMagStrength: { value: magStrength },
          uRiseOn: { value: isArise ? 1 : 0 },
          uRise: { value: rise },
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, emissive, plaster, plasterScale],
  );

  // keep cheap-to-update uniforms in sync with props
  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uEmissiveWeight.value = emissiveWeight;
    material.uniforms.uMid.value = mid;
    material.uniforms.uReliefStrength.value = reliefStrength;
    material.uniforms.uShadow.value = shadow;
    material.uniforms.uHighlight.value = highlight;
    material.uniforms.uContrast.value = contrast;
    material.uniforms.uWateryOn.value = isWatery ? 1 : 0;
    material.uniforms.uLiquidAmp.value = liquidAmp;
    material.uniforms.uLiquidFreq.value = liquidFreq;
    material.uniforms.uLiquidSpeed.value = liquidSpeed;
    material.uniforms.uCaustic.value = caustic;
    material.uniforms.uMagnify.value = isMagnifying ? 1 : 0;
    material.uniforms.uMagStrength.value = magStrength;
    material.uniforms.uRiseOn.value = isArise ? 1 : 0;
    material.uniforms.uRise.value = rise;
    if (tint) material.uniforms.uTint.value.copy(tint);
  }, [
    emissiveWeight,
    mid,
    reliefStrength,
    shadow,
    highlight,
    contrast,
    tint,
    isWatery,
    liquidAmp,
    liquidFreq,
    liquidSpeed,
    caustic,
    isMagnifying,
    magStrength,
    isArise,
    rise,
  ]);

  const introStart = useRef<number | null>(null);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTrail.value = trailRef.current;
    material.uniforms.uTime.value = state.clock.elapsedTime;

    // intro: fade a full-screen reveal down to the `reveal` floor
    const t = state.clock.elapsedTime;
    if (introStart.current === null) introStart.current = t;
    const k = Math.min((t - introStart.current) / introDuration, 1);
    const eased = 1 - k * k * (3 - 2 * k); // smoothstep 1 -> 0
    material.uniforms.uReveal.value = Math.max(reveal, introFrom * eased);
  });

  return (
    <mesh geometry={geometry} scale={[scale, scale, 1]}>
      <shaderMaterial ref={materialRef} args={materialArgs} />
    </mesh>
  );
}

useGLTF.preload(GLB_URL, "/draco/");
