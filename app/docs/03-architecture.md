# System Architecture

## Input layer

- Mouse move events
- Normalized cursor position (0–1)

## State layer

- Current mouse position
- Previous positions (trail buffer)
- Time-based animation state

## Render layer options

### Option A: Canvas 2D

- Draw fading circles
- Use alpha decay for trail

### Option B: WebGL (recommended)

- Plane geometry fullscreen
- Shader-based distortion
- Uniform: uMouse, uTime

## Animation loop

requestAnimationFrame loop:

1. update mouse smoothing
2. update trail buffer
3. render frame
