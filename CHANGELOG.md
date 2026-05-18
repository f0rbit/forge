# @f0rbit/forge

## 0.5.0

### Minor Changes

- `feat(autotile)`: new `@f0rbit/forge/autotile` subpath — Godot 3x3 minimal autotile (47-tile, corner-based, 8-direction).

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

## 0.4.3

### Patch Changes

- Add `RenderState.set_screen_offset(dx, dy)` to `@f0rbit/forge/pixi` — a strictly-additive camera-shake primitive that offsets the composited surface sprite in screen-space without disturbing the world container or camera viewport.

  ```ts
  import { make_render } from "@f0rbit/forge/pixi";

  const render = (await make_render({ camera })).value!;

  // nudge the screen for a camera-shake frame
  render.set_screen_offset(5, -3);

  // back to neutral
  render.set_screen_offset(0, 0);
  ```

  The offset is preserved across `render.resize(w, h)` — the new viewport offset is re-applied with the current `(dx, dy)` on top. Internally it mutates the offscreen-composited `surface_sprite.position` on `app.stage`; no changes to `app.render.world` or `camera`. Use it from a `pre`-stage system to drive shake; reset to `(0, 0)` once the shake decays.

## 0.4.2

### Patch Changes

- Add ergonomic coord-transform helpers to `@f0rbit/forge/pixi`:

  ```ts
  import { coord_transform, event_to_world, type CoordTransform } from "@f0rbit/forge/pixi";

  const ct = coord_transform(app.camera);
  // ct.scale, ct.offset, ct.view, ct.canvas_to_world(x,y), ct.world_to_canvas(x,y)

  canvas.addEventListener("pointerdown", (e) => {
    const world = event_to_world(e, canvas, app.camera);
    const cell = { x: Math.floor(world.x / tile), y: Math.floor(world.y / tile) };
  });
  ```

  `event_to_world(e, canvas, cam)` solves the recurring "I have a DOM `PointerEvent`, give me a world cell" use case consumers kept reinventing. It handles `getBoundingClientRect` translation and CSS-pixel-to-canvas-buffer DPR scaling, then delegates to the existing `cam.screen_to_world` (which round-trips). Additive surface; existing `camera.screen_to_world` / `world_to_screen` unchanged.

## 0.4.0

### Minor Changes

- Add `@f0rbit/forge/light` — unified grid-illumination subpath. Promoted from echo's `bestiary` and `dungeon-walk` subsystems after the 2-consumer threshold was met and the API stabilised across several debugging rounds.

  ```ts
  import {
    make_light_system,
    make_light_update_system,
    make_eye_follow_system,
    make_light_follow_system,
    make_marker_light_follow_system,
    presets,
    candle_flicker,
    fluorescent_flicker,
    sine_flicker,
    torch_flicker,
    type LightSystem,
    type LightSpec,
    type LightHandle,
    type LightSystemConfig,
    type EyeLightConfig,
    type FlickerProfile,
    type ScenePreset,
  } from "@f0rbit/forge/light";
  ```

  - Per-light additive RGB grid accumulator written to a `BufferImageSource`, blended via a Pixi `Filter` with WebGL + WebGPU shader paths.
  - Deterministic flicker profiles (`torch`, `candle`, `fluorescent`, `sine`) — pure functions of `(seed, t)`.
  - Six built-in scene presets (`moon_cavern`, `warm_torch`, `frostbite`, `lab`, `sunset`, `hellscape`).
  - Three convenience follow systems for binding lights to entities (eye-follow, id-follow, marker-follow).
  - `pixi.js` peer dep already declared as optional `^8` — no new peer dep.

  Internally placed under `src/pixi/light/` because the system depends directly on pixi runtime classes (`Filter`, `BufferImageSource`, `GlProgram`, `GpuProgram`, `UniformGroup`); the `./light` URL alias in `exports` keeps the consumer-facing path tidy.

  No breaking changes elsewhere.

## 0.3.3

### Patch Changes

- Add `follow_c` + `follow_system` — entity-follow primitive every game with HUD elements, attached weapons, child sprites, or indicator visuals will want.

  ```ts
  import { follow_c, type Follow } from "@f0rbit/forge";

  // Spawn a health bar that tracks an enemy 16px above
  const bar_id = world.spawn(
    [pos_c, { x: 0, y: 0 }],
    [follow_c, { target: enemy_id, offset: { x: 0, y: -16 } }]
    // ... sprite + bar contents
  );
  ```

  `follow_system` registered automatically in the post stage by `boot()`. Updates follower's pos to target's pos + offset every tick. Silently skips if target was despawned. Zero overhead when no entities have `follow_c`.

## 0.3.2

### Patch Changes

- Additive lighting + sprite primitives for soft FOV. Both feed game-feel polish in any grid game with vision mechanics.

  - `SpriteData.alpha?: number` — sprite_sync_system applies node.alpha when set. Default = 1.0 (no change to existing consumers).
  - `Grid.lit_area({ from, radius, is_blocking, falloff? }) → Map<key, intensity>` — parallel to `line_of_sight` but returns float intensity per cell instead of boolean visibility. Default falloff is linear `1 - distance/radius`. Consumers pass custom falloff for quadratic / smoothstep / torch-flicker / etc.

  Use case: replace binary visible/hidden FOV with gradient lighting — cells closer to player brighter, distant cells dimmer, occluded cells dark. Wires through SpriteData.alpha.

  Zero breaking changes. Existing line_of_sight unchanged.

## 0.3.1

### Patch Changes

- Fix tick/schedule lockstep — periodic systems were firing erratically (extra fires on fast frames, skipped fires on slow frames) because the pixi render loop called `schedule.tick` exactly once per RAF callback regardless of how many simulation ticks `time.advance` consumed.

  Manifests as "movement too fast/erratic" in any game using `schedule.add(stage, sys, { every: N })` for periodic systems. Confirmed in both `dungeon-walk` and `bestiary`.

  **Fix**: `time.advance(real_dt, each?)` accepts an optional callback fired once per consumed tick. The pixi render loop wires the callback to `schedule.tick` so simulation runs exactly once per consumed simulation tick.

  **Added regression test**: `test/integration/lockstep.test.ts` — runs 600 frames with jittered real_dt and asserts a periodic system fires exactly the expected count.

  No consumer code changes needed (additive callback parameter). Subsystems will see correct movement timing on next `bun install`.

## 0.3.0

### Minor Changes

- v0.3.0 — interface cleanup. Breaking changes are intentional pre-1.0; this pass simplifies the public API by removing redundant surface that v0.2.0's "no breaking" rule baked in.

  ## Breaking changes

  ### Core (`@f0rbit/forge`)

  - **`world.query` auto-elides marker components.** `query([pos_c, player_c, dir_c])` yields `[Id, Pos, Dir]` (no `true` slot). `world.query_data` removed — use `query` directly.
  - **`schedule.add(stage, sys, opts?)` unified.** `opts.every` and `opts.phase` gate periodic execution; `opts.name` labels. Bare-string `name` positional kept as sugar. `schedule.add_periodic` removed.
  - **`replay.record(input, ctx, opts?)` unified.** Pulls `fixed_dt`, `get_tick`, `seed` from `ctx`. `replay.record_engine` removed.
  - **`replay_schema` top-level export** replaces `replay.schema`.
  - **Resource keys carry `_r` suffix** (forge-exported): `atlas_registry_r`, `anim_events_r`.
  - **`world.spawn_at` moved to `world[internal]`** — implementation-detail-only for snapshot restore.

  ### `@f0rbit/forge/grid`

  - **`line`, `line_of_sight`, `move_tile` are now methods on the `Grid` record** returned by `grid({...})`. Standalone exports removed. `FovOpts.grid` and `TileMoveOpts.grid` slots removed (grid is now `this`). `TileMoveOpts.pos` defaults to canonical `pos_c`.

  ### `@f0rbit/forge/pixi`

  - **`assets.load<K>(kind, alias, url)` unified loader** replaces `assets.image` / async `assets.atlas`. Synchronous getters `assets.texture(alias)` and `assets.atlas(alias)` retained. `AssetKind`, `LoadValue<K>` exported.
  - **`SpriteData` is config-only**. Runtime PIXI Sprite refs live in a private `WeakMap<World, Map<Id, Sprite>>`. New `sprite.set(w, id, partial)`, `sprite.show(w, id)`, `sprite.hide(w, id)` helpers. `sprite_internal` named export deleted.
  - **`anim_c.t` marked `@internal`** in JSDoc — replay determinism requires the field; consumers shouldn't read/write directly.

  ### `@f0rbit/forge/presets`

  - Renamed for snake_case consistency: `movement2d → movement_2d`, `movement8way → movement_8way`, `movement_4way_digital → movement_4way` (drop `_digital` since it's the default for 4-way).

  ## Additive

  - `world.spawn_many([...specs])` array overload alongside the existing `(count, factory)` form.

  ## Tests

  340 → 354 (+14 net across the cleanup). Replay determinism preserved.

  ## Migration

  Consumers should expect ~30-40 LOC saved on top of v0.2.0's reductions:

  - `dungeon-walk` (echo): another ~37 LOC saved (cumulative ~145 from v0.1.x).
  - `coin-collector`: ~10 LOC saved (preset name update + minor signature touchups).

## 0.2.0

### Minor Changes

- v0.2.0 — bulk forge improvements driven by friction findings from `dungeon-walk` (the first echo subsystem). Zero breaking changes.

  ## Core additions (`@f0rbit/forge`)

  - `schedule.add_periodic(stage, sys, { every, phase? })` — wraps a system to run only every N ticks (with optional phase shift). Eliminates the `if (tick % step !== 0) return` boilerplate every periodic system was hand-writing.
  - `world.query_data(data, markers, opts?)` — companion to `query()` that strips markers from the yielded tuple. `query_data([pos_c], [player_c])` yields `[Id, [Pos]]` instead of `[Id, [Pos, true]]` — removes the brittle `true`-in-destructure pattern.
  - `world.spawn_many(count, factory)` — convenience for level setup, particle bursts, enemy waves. Returns `Id[]`.
  - `world.despawn_marked(...markers)` — despawns every entity matching all listed markers. Returns count despawned.
  - `SpriteData.scale?: { x, y }` (in `/pixi`) — `sprite_sync_system` applies it; default omitted = 1×1. Atlas frame size no longer dictates grid tile size.

  ## New `@f0rbit/forge/grid` subpath

  Opt-in subpath consolidating grid-game primitives every grid-based game (snake, sokoban, roguelike, tetris, dungeon crawler) wants:

  - `grid({ cols, rows, tile })` — factory exposing `cell_to_world`, `world_to_cell`, `key`, `unkey`, `in_bounds`, `neighbors` (4- and 8-way), `chebyshev`, `manhattan`.
  - `line(a, b)` — Bresenham generator. Foundation for FOV, telegraphs, attack indicators, drawing helpers.
  - `line_of_sight({ from, radius, grid, is_blocking })` — Bresenham-based FOV returning `Set<key>` of visible cells.
  - `grid_index(component, grid)` + `grid_index_sync_system` — spatial index over entities at integer cell coords.
  - `move_tile(world, entity, dir, opts)` — read pos, gate by `blocked_by` predicate, write if clear. `slide: true` (default) tries X-then-Y axis-by-axis when diagonal is blocked, preventing corner-cutting through wall pairs.
  - `ticks_per_step({ tile, cells_per_sec, fixed_dt })` — calibrate movement speed without hand-tuning magic step counts.

  ## Presets

  - `presets.movement_4way_digital` — discrete 4-way bindings (no axes, deadzone 0) for tile-step games where analog input is noise.

  ## Documentation

  `/grid` ships with 7 dedicated docs pages and 7 new cookbook patterns covering the v0.2.0 primitives. The site at https://f0rbit.github.io/forge/ reflects everything.

  ## Tests

  292 → 340 (+48). All gates green; replay determinism preserved.

## 0.1.6

### Patch Changes

- Fix cross-bundle `internal` Symbol — change `Symbol("internal")` to `Symbol.for("internal")`. Same fix pattern as v0.1.2's `pos_c` cross-bundle fix. Consumer code accessing `world[internal]` via the main entry now resolves to the same symbol as code in `/pixi`.

  Add public `world.clear()` method — despawns every entity and clears all component stores. Useful for hard restarts. Resources are NOT cleared (separate concern).

## 0.1.5

### Patch Changes

- Drop `USAGE.md` from the repo and the published tarball. The docs site at https://f0rbit.github.io/forge/ is now the canonical reference; no need to maintain a separate single-file copy that would drift.

  `package.json` `files` no longer lists `USAGE.md`.

## 0.1.4

### Patch Changes

- Drop vestigial `BootOpts.width / .height / .background` fields. Use `window` + `camera.design` opts instead. **Breaking** — but no consumers besides coin-collector which already uses the new shape.

  Rename debug HUD `stats.scale` → `stats.tscale` so it doesn't collide visually with viewport scale. Matches the `tscale` palette command.

## 0.1.3

### Patch Changes

- Pixel-perfect dynamic viewport: PixelatedPope-style two-stage rendering, new camera modes, and FPS HUD fix.

  **Breaking** — `BootOpts.camera` shape changed and the camera modes were rewritten. The old `{ mode: "fit" | "fill" | "fixed", width, height, pos, zoom }` shape is replaced with `{ design: { width, height }, mode: "letterbox" | "extend" | "extend-x" | "extend-y" | "fit", min?, max?, pixel_perfect?, smoothing? }`. `Camera.apply()` is removed; layout now happens through the render system. World coordinates are now design coordinates (no per-frame container scaling). New `BootOpts.window` field carries the host window size.

  **Feature** — pixel-perfect dynamic viewport with two-stage rendering. Each frame the world container is rendered into a `RenderTexture` sized to the design viewport (or the extended viewport in `extend*` modes), and a stage-level `Sprite` rescales that surface to the host window with integer scale and centering offset. Texture scaling defaults to `nearest`; flip with `smoothing: true`.

  **Feature** — `extend`, `extend-x`, `extend-y` modes show more world on larger windows. `min` floors the design viewport so the game never sees less than authored; `max` caps the extension to bound visible world. `letterbox` keeps the design viewport identical to authored size with black bars around it. `fit` is the only mode that uses fractional scale.

  **Fix** — debug HUD's `fps` field used to read back its own stale value (always `0.0`). The render system now computes a real-time, smoothed FPS via `performance.now()` (allowed inside `src/pixi/`) and writes it into `debug.stats().fps` each frame. The calculation is gated on `__DEV__`; production builds skip it entirely.

## 0.1.2

### Patch Changes

- Fix cross-bundle component / resource identity. `component(name)` and `resource(name)` now use `Symbol.for(...)` (global symbol registry) instead of `Symbol(...)`, so component descriptors with the same name share identity across bundles.

  Previously, when a consumer imported `pos_c` from `@f0rbit/forge` and forge's pixi subpath bundle (`@f0rbit/forge/pixi`) had its own copy of `pos_c`, the two were different `Symbol` instances. World stores keyed off `Component.key` couldn't find entities the consumer had spawned with what looked like the same component, so `sprite_sync_system` (and any internal system relying on shared component keys) silently saw zero matches. The result was a black screen — sprites never got created.

  Behavioural note: `component("foo") === component("foo")` is now true (their `key` symbols match). This matches the conceptual contract — components are identified by name — and is required for correct cross-subpath behaviour.

## 0.1.0

### Minor Changes

- First public release of `@f0rbit/forge` — a small, functional, composition-first TypeScript game engine.

  **Engine core (`@f0rbit/forge`)**

  - Deterministic ECS — `world()` factory, `Component<T>` brand, insertion-ordered queries
  - Stages-and-systems schedule (`startup` / `pre` / `update` / `post` / `render`)
  - Fixed-timestep `time()` with `scale` for slo-mo / fast-forward
  - Seeded `rng()` (mulberry32) with subsystem forks
  - Symbol-keyed typed `resources()` registry
  - Action-layer `input()` with key / mouse / pad bindings + presets
  - Replay record + playback over JSON action streams
  - World snapshot encode/decode with Zod schemas
  - Sprite-frame animation: `anim()` advance system, `anim_c` component, atlas registry resource

  **Storage (`@f0rbit/forge/storage`)**

  - `engine_store({ backend: "mem" | "file" })` wrapping `@f0rbit/corpus`
  - Typed sub-stores for snapshots, bindings, prefs
  - Save slots layered on tags

  **Debug (`@f0rbit/forge/debug`)**

  - `debug()` headless command buffer (line / circle / rect / text / pin / counter)
  - Stats tracking (tick / fps / entities / system timings)
  - `debug_noop()` zero-cost stub for production builds via `__DEV__` define

  **Palette (`@f0rbit/forge/palette` re-exported from main)**

  - `palette()` registry with fuzzy search, history, runtime command registration
  - Built-ins: save / load / pause / resume / tscale / bind / unbind / inspect / dbg

  **Presets (`@f0rbit/forge/presets`)**

  - `movement2d`, `platformer`, `twinstick` ready-to-go binding sets

  **PIXI v8 adapter (`@f0rbit/forge/pixi`)**

  - `boot({ mount, width, height, ... })` big-bang entry, returns a `Result<App, BootError>`
  - `assets()` Result-typed loader with typed `assets.atlas` for TexturePacker JSON-Hash
  - Built-in `__default__` placeholder atlas (4-frame magenta/cyan/yellow/black, 16×16, inline data)
  - `browser_source()` unified DOM + Gamepad InputSource (4 pads, deadzone, dispose)
  - `camera({ mode: "fit" | "fill" | "fixed" })` with letterbox math + world↔screen helpers
  - `make_render()` PIXI Application bootstrap with world / debug / palette overlay containers
  - `sprite_c` + `sprite_sync_system` ECS-to-`Sprite` bridge (lazy node creation, despawn cleanup)
  - `anim_sync_system` pushes ECS frame state onto `Sprite.texture` (never uses `AnimatedSprite`)
  - `debug_pixi` Graphics + Text overlay drained from `debug.frame()`
  - `palette_pixi` overlay UI with autocomplete, history, error rendering

  PIXI is consumed strictly as a peer-dep of the `/pixi` subpath; non-pixi consumers skip it entirely. Determinism is quarantined to `src/pixi/` — no `Date.now`, `Math.random`, `setTimeout`, `setInterval`, or PIXI imports outside that directory.
