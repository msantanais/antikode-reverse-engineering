# Effect Analysis

## Observed behavior

- Cursor movement creates a trailing distortion
- Effect feels "liquid" or "gooey"
- Background reacts to cursor position
- Smooth easing (not instant movement)

## Likely techniques used

### 1. Mouse smoothing

- Linear interpolation (lerp)
- Or spring physics

### 2. Trail system

- Multiple points following cursor
- Or single displacement field

### 3. WebGL shader distortion

- Fragment shader uses mouse position
- UV distortion based on distance field

### 4. Post-processing

- Blur / displacement / noise overlay
