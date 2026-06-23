// Relief reveal shader.
//
// The relief look is entirely baked into two textures shipped in the GLB:
//   uBase     (glTF baseColor)  – baked lit relief, plaster-toned base
//   uEmissive (glTF emissive)   – additive lit/highlight pass
// The meshes carry no normals, so there is no real-time lighting: we just
// composite the baked maps. The cursor-trail mask (uTrail, sampled in screen
// space) controls how much of the relief emerges from the flat plaster.

export const reliefVertexShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTrail;   // screen-space reveal mask
  uniform float uRiseOn;      // 1 = relief rises toward the cursor
  uniform float uRise;        // how far it rises (model units, toward camera)

  varying vec2 vUv;
  varying vec4 vClip;

  void main() {
    vUv = uv;

    vec3 p = position;
    if (uRiseOn > 0.5) {
      // sample the reveal mask at this vertex's screen position, then push the
      // surface toward the camera (+z) so the relief swells up under the cursor.
      vec4 clip0 = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec2 s0 = clip0.xy / clip0.w * 0.5 + 0.5;
      float m = texture2D(uTrail, s0).r;
      p.z += m * uRise;
    }

    vClip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_Position = vClip;
  }
`;

export const reliefFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uBase;      // baked lit relief (carries shading)
  uniform sampler2D uEmissive;  // baked highlight/lighting pass
  uniform sampler2D uTrail;     // screen-space reveal mask
  uniform sampler2D uPlaster;
  uniform vec2  uPlasterScale;
  uniform float uUseColor;      // 1 = solid colour background instead of plaster
  uniform vec3  uBgColor;       // the solid background colour (raw sRGB 0..1)
  uniform float uEmissiveWeight;   // how much the emissive pass adds to shading
  uniform float uMid;              // luminance of the flat (uncarved) surface
  uniform float uReliefStrength;   // how strongly raised detail brightens
  uniform float uShadow;           // gentle darkening of recesses (0 = none)
  uniform float uHighlight;        // extra glint on raised, lit detail
  uniform vec3  uTint;             // warm clay tint
  uniform float uReveal;           // global reveal floor (intro sweep)
  uniform float uContrast;         // shapes the reveal transition

  // liquid / water
  uniform float uTime;
  uniform float uWateryOn;         // 1 = apply the rippling water effect
  uniform float uLiquidAmp;        // ripple displacement (uv units)
  uniform float uLiquidFreq;       // ripple frequency
  uniform float uLiquidSpeed;      // ripple flow speed
  uniform float uCaustic;          // moving specular sheen on the wet surface

  // magnifying glass
  uniform float uMagnify;          // 1 = zoom the revealed area like a lens
  uniform float uMagStrength;      // lens magnification amount

  varying vec2 vUv;
  varying vec4 vClip;

  const vec3 LUMA = vec3(0.299, 0.587, 0.114);

  // value noise + fbm, used to wobble the reveal boundary into a liquid blob
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 3; i++) { v += amp * vnoise(p); p *= 2.0; amp *= 0.5; }
    return v;
  }

  void main() {
    vec2 screenUv = vClip.xy / vClip.w * 0.5 + 0.5;

    // wobble: warp where we read the reveal mask with flowing fbm noise, so the
    // round brush dissolves into an organic, rippling liquid blob.
    float et = uTime * 0.6;                       // flow speed
    vec2 ec = screenUv * 3.5;                      // lobe size (lower = bigger)
    vec2 edgeFlow = vec2(
      fbm(ec + vec2(0.0, et)),
      fbm(ec + vec2(et, 0.0) + 17.3)
    ) - 0.5;
    vec2 maskUv = screenUv + edgeFlow * 0.14;      // wobble amount

    float mask = texture2D(uTrail, maskUv).r;
    mask = clamp(mask + uReveal, 0.0, 1.0);
    mask = pow(mask, uContrast); // sharpen the emergence

    vec2 uvW = vUv;

    // --- water: domain-warp the sampling UV so the revealed relief ripples
    //     like it is seen through moving water. Distortion scales with mask so
    //     the dry (unrevealed) plaster stays perfectly flat.
    float t = uTime * uLiquidSpeed;
    float f = uLiquidFreq;
    vec2 warp = vec2(
      sin(vUv.y * f + t) + 0.5 * sin(vUv.y * f * 2.1 - t * 1.3),
      cos(vUv.x * f - t * 0.9) + 0.5 * cos(vUv.x * f * 1.7 + t * 1.1)
    );
    uvW += warp * uLiquidAmp * mask * uWateryOn;

    // --- magnifying glass: displace the sampling UV using the gradient of the
    //     reveal mask, so the revealed blob bulges outward like a lens and the
    //     relief there reads as zoomed in.
    if (uMagnify > 0.5) {
      float e = 0.0035;
      float gx = texture2D(uTrail, screenUv + vec2(e, 0.0)).r
               - texture2D(uTrail, screenUv - vec2(e, 0.0)).r;
      float gy = texture2D(uTrail, screenUv + vec2(0.0, e)).r
               - texture2D(uTrail, screenUv - vec2(0.0, e)).r;
      uvW += vec2(gx, gy) * uMagStrength;
    }

    // The relief is the SAME plaster material, only carved: derive a monochrome
    // shading term from the (blue-ish) baked maps and use it to sculpt plaster.
    float lb = dot(texture2D(uBase, uvW).rgb, LUMA);
    float le = dot(texture2D(uEmissive, uvW).rgb, LUMA);
    float lum = lb + (le - uMid) * uEmissiveWeight;

    // Raised detail brightens the plaster; recesses only darken slightly and are
    // clamped so nothing ever crushes to black (no harsh shadows).
    float d = lum - uMid;
    float shade = d > 0.0 ? d * uReliefStrength : d * uShadow;
    shade = max(shade, -0.3); // gentle grey shadow, never crushes to black
    float glint = max(le - uMid, 0.0) * uHighlight;

    // moving caustic sheen — bright bands sliding across the wet surface
    float caustic = sin((uvW.x - uvW.y) * f * 1.5 + t * 1.7) * 0.5 + 0.5;
    caustic = pow(caustic, 3.0) * uCaustic * mask * uWateryOn;

    vec3 plaster = texture2D(uPlaster, screenUv * uPlasterScale).rgb;
    vec3 bg = mix(plaster, uBgColor, uUseColor);
    vec3 relief = bg * uTint * (1.0 + shade) + glint + caustic;

    vec3 col = mix(bg, relief, mask);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const plasterFragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D uPlaster;
  uniform vec2 uPlasterScale;
  uniform float uUseColor;
  uniform vec3 uBgColor;
  varying vec2 vUv;
  void main() {
    vec3 plaster = texture2D(uPlaster, vUv * uPlasterScale).rgb;
    gl_FragColor = vec4(mix(plaster, uBgColor, uUseColor), 1.0);
  }
`;

export const plasterVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    // fullscreen background quad: vUv = screen uv
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0); // z=1 -> behind everything
  }
`;
