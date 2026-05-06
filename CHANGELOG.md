# @f0rbit/forge

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
