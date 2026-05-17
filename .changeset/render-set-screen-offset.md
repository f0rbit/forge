---
"@f0rbit/forge": patch
---

Add `RenderState.set_screen_offset(dx, dy)` to `@f0rbit/forge/pixi` — a strictly-additive camera-shake primitive that offsets the composited surface sprite in screen-space without disturbing the world container or camera viewport.

```ts
import { make_render } from "@f0rbit/forge/pixi";

const render = (await make_render({ camera })).value!;

// nudge the screen for a camera-shake frame
render.set_screen_offset(5, -3);

// back to neutral
render.set_screen_offset(0, 0);
```

The offset is preserved across `render.resize(w, h)` — the new viewport offset is re-applied with the current `(dx, dy)` on top. Internally it mutates the offscreen-composited `surface_sprite.position` on `app.stage`; no changes to `app.render.world` or `camera`. Use it from a `pre`-stage system to drive shake; reset to `(0, 0)` once the shake decays.
