# @f0rbit/forge

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
