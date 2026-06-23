# Cursor‑Reveal Relief — Summary

A reverse‑engineering of the hero interaction on **immersive‑g.com** (Immersive
Garden), rebuilt with **React Three Fiber**.

---

## What the effect is called

There isn't one official name, but it's an **interactive bas‑relief reveal** (a
"cursor‑reveal" / "displacement reveal"). The cursor doesn't distort the
image — it **reveals** a 3D relief that is otherwise flush with a flat surface.
Move the cursor and an embossed sculpture (birds, flowers, foliage) emerges from
the surface along the cursor's path, then fades back as you move away.

The underlying building blocks are common WebGL techniques:

- **Trail / flow‑map reveal** — a fading "where the cursor has been" mask kept in
  a feedback (ping‑pong) buffer.
- **Screen‑space masking** — the relief is shown only where that mask is lit.
- **Baked relief shading** — the 3D look is baked into textures, not lit in real
  time.
- **Liquid edge (always on)** — where the mask is sampled is warped by flowing
  fbm noise, so the round reveal dissolves into an organic, rippling liquid
  blob. Built into `relief.ts` with inline constants (wobble amount, lobe size,
  flow speed).

On top of that, three optional **effect modes** can further shape the reveal:

| Mode | What it does |
|------|--------------|
| `isWatery` | The revealed relief ripples like it's seen through moving water (domain‑warp + caustic sheen). |
| `isMagnifying` | The revealed blob bulges outward like a lens (zoom). |
| `isArise` | The relief physically **rises toward the cursor** (real geometry displacement). |

---

## How it works (pipeline)

1. **Cursor trail → reveal mask.** Every frame the previous mask is faded
   (decay) and a soft brush is stamped along the segment between the previous and
   current smoothed cursor position. A second, autonomous brush sweeps short
   random strokes so the effect animates on its own. The result is a single
   greyscale **reveal mask** in screen space, held in a ping‑pong FBO.
2. **Relief composite.** A fullscreen‑ish relief mesh samples that mask in screen
   space. Where the mask is lit it blends from the flat background to the lit
   relief; everywhere else it stays the background. The relief look comes from
   two baked textures (the meshes carry **no normals**), composited as a
   monochrome shading term so the relief is the *same material as the
   background, only carved*.
3. **Shaping.** The liquid edge warps where the mask is read (flow‑noise); water
   warps where the relief texture is read; magnify warps along the mask gradient;
   arise displaces the mesh vertices toward the camera by the mask.
4. **Background.** Either the plaster texture or a solid colour; the relief tint
   follows it so the carving always matches the surface.

---

## Components

```
app/
├─ page.tsx                     # renders <Hero/>
├─ components/
│  ├─ Hero.tsx                  # overlay UI + custom cursor; lazy-loads the canvas (ssr:false)
│  ├─ HeroScene.tsx             # <Canvas>, background, wiring + all the tunable props
│  └─ Relief.tsx                # loads the GLB, builds the reveal ShaderMaterial, drives uniforms
├─ hooks/
│  └─ useCursorTrail.ts         # ping-pong FBO trail: cursor brush + autonomous random pulse
├─ shaders/
│  ├─ trail.ts                  # accumulates the reveal mask (decay + brush strokes)
│  └─ relief.ts                 # relief reveal + liquid edge / water / magnify; plaster background
└─ docs/                        # reference media + findings (06-findings.md)

public/
├─ 3d/reliefs_low_compressed.glb  # 6 relief meshes (bird, deer, dragonflies, frog, peacock, squirrel)
├─ home/plaster.jpg               # background surface texture
└─ draco/                         # local Draco decoder
```

**Key props** (on `<HeroScene>` in [app/components/Hero.tsx](app/components/Hero.tsx)):
`relief`, `bgColor` (hex string, omit for plaster), `isWatery`, `isMagnifying`,
`isArise`.

**Feel / tuning knobs:**

- **Reveal delay (lag)** — `ease` in the `useCursorTrail({…})` call in
  `HeroScene.tsx`. Lower = the reveal trails further behind the cursor; higher =
  snappier.
- **Trail length** — `decay` (same call). Higher (→1) = longer fading tail.
- **Reveal size** — `radius` / `autoRadius` (same call).
- **Liquid wobble** — inline constants in `relief.ts` (wobble amount, lobe size,
  flow speed).
- **Edge sharpness / shading** — `contrast`, `reliefStrength`, `shadow`, `tint`
  props on `<Relief>` in `HeroScene.tsx`.

---

## Tech used

- **Next.js 16** (App Router) — the canvas is a Client Component lazy‑loaded with
  `next/dynamic` (`ssr:false`) since WebGL is browser‑only.
- **React Three Fiber 9** + **three.js 0.184** — declarative WebGL scene.
- **@react-three/drei** — `useGLTF` (with a local **Draco** decoder) and
  `useTexture`.
- **Custom GLSL shaders** — the whole effect is custom `ShaderMaterial`s:
  - a **ping‑pong FBO** (two render targets, 8‑bit so the mask is readable in the
    vertex stage on all GPUs) for the decaying cursor trail;
  - a relief shader doing screen‑space mask sampling, monochrome relief shading,
    and the liquid‑edge / water / magnify / arise distortions;
  - **vertex texture fetch** for the "arise" displacement.
- **Assets** — Draco‑compressed geometry + WebP textures in a single GLB; a
  tiling plaster texture.
- **Raw colour pipeline** — textures are treated as `NoColorSpace` data and
  composited WYSIWYG (the relief is unlit; all shading is baked), with a
  frame‑rate‑independent decay so the trail behaves the same at any FPS.

See [app/docs/06-findings.md](app/docs/06-findings.md) for the reverse‑engineering
notes (what the assets actually contained and why the approach is what it is).
