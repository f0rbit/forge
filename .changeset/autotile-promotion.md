---
"@f0rbit/forge": minor
---

`feat(autotile)`: new `@f0rbit/forge/autotile` subpath — Godot 3x3 minimal autotile (47-tile, corner-based, 8-direction).

```ts
import { make_wall_autotile_system } from "@f0rbit/forge/autotile";

schedule.add(
  "startup",
  make_wall_autotile_system({ wall_c, grid: g, texture: "walls" }),
  "walls.autotile",
);
```

Each wall entity is sampled against its 8 neighbours; the four corners are classified into one of five states (OUTER / SIDE_A / SIDE_B / CONCAVE / FILLED), and the resulting key indexes a 47-entry lookup table that maps directly onto Godot's `autotile_template_3x3_minimal.png` layout (12 cols x 4 rows, e.g. 0x72's `atlas_walls_low-16x16.png`). Diagonal-gating rule collapses the 256 raw 8-neighbour patterns onto the 47 unique tiles.

`AutotileOpts` injects the project-specific marker component (`wall_c: Component<true>`), the `Grid` used for cell mapping, the atlas alias, and an optional sprite `z` (default `2`). Also exports `LOOKUP`, `compute_corner_states`, `corner_state`, and the `OUTER`/`SIDE_A`/`SIDE_B`/`CONCAVE`/`FILLED` constants for debug overlays.

Additive minor bump (no breaking changes).
