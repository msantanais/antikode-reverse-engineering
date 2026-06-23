// Cursor-trail accumulation shader (ping-pong FBO).
//
// Each frame the previous trail buffer is faded by `uDecay` and a soft brush is
// stamped along the segment between the previous and current (smoothed) cursor
// position. The result is a single-channel "reveal mask" in screen space that
// lights up under the cursor and slowly decays behind it.

export const trailVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const trailFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uPrev;     // previous trail buffer
  uniform float uAspect;       // width / height (keeps the brush circular)
  uniform float uDecay;        // per-frame persistence (0..1)
  uniform float uClear;        // subtractive fade so an 8-bit buffer reaches 0
  uniform float uStrength;     // brush intensity

  // brush A — the real cursor
  uniform vec2  uMouse;
  uniform vec2  uMousePrev;
  uniform float uRadius;
  uniform float uMouseOn;      // 0 until the pointer is first used
  uniform float uSpeedBoost;

  // brush B — the autonomous wanderer (independent of the cursor)
  uniform vec2  uAuto;
  uniform vec2  uAutoPrev;
  uniform float uAutoRadius;
  uniform float uAutoOn;

  varying vec2 vUv;

  // distance from point p to segment a-b
  float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
  }

  float stroke(vec2 p, vec2 a, vec2 b, float radius) {
    return smoothstep(radius, 0.0, sdSegment(p, a, b));
  }

  void main() {
    // multiplicative decay plus a small subtractive term: on an 8-bit buffer the
    // multiply alone stalls at low values, so the trail would never fully clear.
    float prev = max(texture2D(uPrev, vUv).r * uDecay - uClear, 0.0);

    vec2 p = vec2(vUv.x * uAspect, vUv.y);

    float cursor = stroke(
      p,
      vec2(uMouse.x * uAspect, uMouse.y),
      vec2(uMousePrev.x * uAspect, uMousePrev.y),
      uRadius
    ) * uStrength * (1.0 + uSpeedBoost) * uMouseOn;

    float wander = stroke(
      p,
      vec2(uAuto.x * uAspect, uAuto.y),
      vec2(uAutoPrev.x * uAspect, uAutoPrev.y),
      uAutoRadius
    ) * uStrength * uAutoOn;

    float v = max(prev, max(cursor, wander));
    gl_FragColor = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
  }
`;
