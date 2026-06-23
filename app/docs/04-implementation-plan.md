# Implementation Plan

## Step 1: Basic cursor tracking

- Listen to mousemove
- Store x/y normalized

## Step 2: Smooth movement

- Apply lerp:
  target → current

## Step 3: Create trail

- Store array of previous positions
- Shift old positions

## Step 4: Render approach

### MVP (Canvas)

- Draw circles with fading alpha

### Advanced (WebGL)

- Create fullscreen plane
- Add shader distortion

## Step 5: Polish

- Add easing
- Add blur / glow
- Add inertia

## Step 6: Match reference

- Tune smoothing speed
- Adjust distortion strength
