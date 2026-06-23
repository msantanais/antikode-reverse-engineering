# Technical Notes

## Key concept: Inertia

The effect relies heavily on delayed response:

- Cursor moves instantly
- Visual effect follows slowly

## Key concept: Field distortion

Instead of drawing cursor:

- You distort the entire scene
- Based on distance from cursor

## Key concept: Smooth animation

Use:

- lerp (linear interpolation)
- or spring physics

Example:

```js
position += (target - position) * 0.1;
```
