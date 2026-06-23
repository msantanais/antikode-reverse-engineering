# Reverse-engineering findings — the real mechanism

The earlier notes (01–05) were generic guesses ("fluid distortion", "UV
displacement", "post-processing blur"). After inspecting the **actual assets**
shipped in `public/`, the effect turned out to be something more specific and
simpler to reason about.

## What the effect actually is

It is **not** a fluid/distortion shader. It is a **bas-relief reveal**:

- `public/3d/reliefs_low_compressed.glb` contains six real relief meshes
  (bird, deer, dragonflies, frog, peacock, squirrel), stacked vertically and
  Draco-compressed. The hero shows the **bird** relief.
- Each mesh has **no normals** and only `POSITION` + `TEXCOORD_0`. The 3D look
  is **baked into two 2048² WebP textures** per relief:
  - glTF `baseColorTexture` (`*_packed_01`) — a baked, lit relief render.
  - glTF `emissiveTexture` (`*_packed_02`, factor `[1,1,1]`) — a second
    lighting/highlight pass.
- `public/home/plaster.jpg` is the flat off-white surface the relief lives in.

The cursor doesn't distort anything — it **reveals** the relief out of the flat
plaster. Where the cursor (and its fading trail) has been, the carved relief
shows; everywhere else you see flat plaster.

## How the reveal is driven

A screen-space **trail mask** accumulated in a ping-pong FBO:

1. Each frame the previous mask is multiplied by a decay factor.
2. A soft brush is stamped along the segment between the previous and current
   (smoothed) cursor position, so fast moves still draw a continuous trail.
3. The result is a single channel that is bright under the cursor and fades
   behind it.

The relief material samples this mask in **screen space** (`gl_Position`-derived
UV), so the reveal follows the cursor on screen regardless of the 3D geometry.

## Key implementation details that mattered

- **Colour**: the baked maps are blue-grey. Rendered as colour they look wrong
  (a blue cloud). The fix is to treat them as a **monochrome shading term**
  (luminance) that *sculpts the plaster* — `plaster * (1 + shade)` — so the
  relief is the same warm plaster material, only carved. Seamless white-on-white.
- **Colour management**: a raw `ShaderMaterial` does no sRGB re-encode, so the
  source textures must be flagged `NoColorSpace` (sampled raw) — otherwise the
  GPU sRGB-decodes them on sampling and everything renders too dark.
- **Frame-rate independence**: decay and easing are normalised to a 60fps step
  (`pow(decay, dt*60)`), so the trail length is identical at any frame rate.
- An **intro sweep** fades a global reveal to zero on load, matching the
  reference's auto-reveal.

## Where it lives

- `app/shaders/trail.ts` — trail accumulation shader (FBO).
- `app/shaders/relief.ts` — relief reveal + plaster background shaders.
- `app/hooks/useCursorTrail.ts` — ping-pong FBO + smoothed cursor.
- `app/components/Relief.tsx` — loads the GLB, builds the reveal material.
- `app/components/HeroScene.tsx` — R3F `<Canvas>`, plaster bg, wiring.
- `app/components/Hero.tsx` — overlay UI + custom cursor, lazy-loads the canvas.

Debug: append `?reveal=1` to the URL to force a full reveal and inspect the bare
relief (any value 0..1 works).
