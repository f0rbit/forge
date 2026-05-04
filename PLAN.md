# game-engine — scoping document

> Status: scoping. No code written yet. The user reviews + approves this doc before any package scaffolding or devpad task creation.
>
> Audience: future Claude sessions, future agents, the user. Single source of truth for the engine project.

---

## 1. Overview

`@f0rbit/forge` — a small, **functional, composition-first** TypeScript game engine published as a **single npm package** with subpath exports. PIXI.js is consumed strictly as a renderer + asset loader at the edge (`@f0rbit/forge/pixi`, peer-dep on `pixi.js`); everything else (ECS, scheduling, input, time, RNG, replay, persistence, debug, palette) is renderer-agnostic and runs headless under `bun test`. Determinism is a hard guarantee, not an aspiration. Replays are scriptable from JSON files, end-to-end.

The engine is the substrate for the user's own games — small embeds on `forbit-astro`, itch.io shorts, eventual Steam wrappers via Tauri, and (post-v1) multiplayer over Colyseus / PartyKit on Cloudflare. **Games live in their own repos** and consume `@f0rbit/forge` from npm (or via `bun link` during dev). It is not a general-purpose game engine and is not intended to compete with Phaser, Bevy, or anything else. It is a personal toolkit, opinionated to the user's stack and workflow.

### Design philosophy (5 bullets)

- **Records of functions over private state.** Factory functions return objects whose methods close over local state. No classes, no `this`, no inheritance. `world`, `time`, `input`, `debug`, `palette`, `store`, `assets` are all built this way.
- **Single-word, lowercase API.** `world.spawn`, `time.advance`, `input.pressed("jump")`, `debug.line(a,b)`, `palette.register(...)`, `store.save(...)`. Compound names only when truly necessary. Files are kebab-case; types are PascalCase; everything else collapses to lowercase or snake_case data fields.
- **Determinism by construction.** Fixed timestep, seeded RNG, no `Date.now()` in engine code, action-stream replay, insertion-ordered systems, sorted entity iteration. Browser non-determinism is quarantined to the `@f0rbit/forge/pixi` edge (`src/pixi/`).
- **Result types everywhere.** `@f0rbit/corpus`'s `Result<T, E>` is the only failure channel. The single permitted `try/catch` site is wrapping a foreign call (PIXI, fs, Gamepad API). `pipe()` chains over nested ifs.
- **Test in-memory first.** Every subsystem has an in-memory representation that runs in `bun test`. The PIXI integration is a thin adapter on top, not a dependency.

---

## 2. Goals + non-goals

### Goals (v1)

| # | Goal |
|---|------|
| G1 | ECS that supports ~10k entities at 60 Hz on a 2024 MacBook Air |
| G2 | Stages-and-systems schedule with deterministic ordering |
| G3 | Action-based input with key/mouse/gamepad bindings + presets |
| G4 | Fixed-timestep simulation with optional render interpolation |
| G5 | Seeded RNG threaded through resources |
| G6 | Replay record + playback driven by JSON action streams |
| G7 | PIXI v8 renderer + asset loader, isolated to one package |
| G8 | Debug rendering primitives (shapes, labels, HUD, inspector) |
| G9 | Command palette with built-in + game-defined commands |
| G10 | Persistence layer wrapping `@f0rbit/corpus` for save slots, snapshots, binding configs |
| G11 | Astro embed component for `forbit-astro` games |
| G12 | One end-to-end example game proving the full stack |

### Non-goals (v1, explicit)

- **No GUI editor.** Terminal-only workflow. The "editor" is Vim + the in-game palette.
- **No 3D.** PIXI is 2D. We don't pretend.
- **No physics.** Use a userland library (Rapier, Planck) per-game if you need it. The engine offers AABB collision queries via systems, not a physics solver.
- **No tweening system.** Numeric tweens (eases, paths, property animation) are game-level concerns until proven otherwise. Sprite-frame animation **is** in the engine — see §5.E.
- **No netcode in v1.** Multiplayer is a future phase. The action-stream/replay architecture is the on-ramp; we build it deterministic now and add transport later.
- **No asset pipeline / packing.** PIXI's loader is sufficient; pipeline tooling is YAGNI until the user's first multi-asset game.
- **No hot-reload, no scripting language, no node-graph.** Edit TS, restart, replay.
- **No React, no Vue.** Solid is fine inside Astro for the embed component, but the engine itself ships zero UI framework dependencies.
- **No IndexedDB / browser persistence in v1.** Storage backends ship as `mem` and `file` only. The `Store<T>` interface is designed so a third backend slots in later without API churn (see §4.10, §5.D).
- **No bundled games inside the forge repo.** `@f0rbit/forge/` is the engine package and only the engine package. Game source lives in separate repos (e.g. `~/dev/coin-collector/`) and depends on `@f0rbit/forge` like any other consumer.

---

## 3. Architecture

### Repo layout — single published package

The forge repo IS the package. Game source never lives in this repo. The `dist/` output (produced by Rolldown) is what ships to npm; subpath exports cover the renderer, debug, storage, and presets entry points.

```
~/dev/forge/                         the @f0rbit/forge repo
├── package.json                     name: "@f0rbit/forge", exports map (see §8)
├── rolldown.config.ts               multi-entry library build
├── tsconfig.json
├── biome.json
├── bun.lock
├── src/
│   ├── index.ts                     main entry: world, schedule, query, time, rng, resources, replay, snap, restore
│   ├── world.ts                     ECS: world, spawn, despawn, query
│   ├── schedule.ts                  stages + systems
│   ├── time.ts                      fixed timestep, accumulator
│   ├── rng.ts                       seeded PRNG (mulberry32 / xoshiro)
│   ├── resources.ts                 typed symbol-keyed resources
│   ├── snapshot.ts                  world serialization (Zod-validated)
│   ├── replay.ts                    record/playback over action streams
│   ├── anim.ts                      sprite animation: anim component + advance system (engine side)
│   ├── input/
│   │   ├── input.ts                 action layer (input.pressed/just/axis)
│   │   ├── source.ts                InputSource provider interface
│   │   ├── scripted.ts              in-memory source for tests + replay
│   │   └── bindings.ts              binding model (action -> raw triggers)
│   ├── presets/
│   │   └── index.ts                 subpath: @f0rbit/forge/presets — movement2d, platformer, twinstick, ...
│   ├── debug/
│   │   ├── index.ts                 subpath: @f0rbit/forge/debug — debug.line/circle/rect, label, pin, inspector, hud
│   │   ├── debug.ts
│   │   ├── inspector.ts
│   │   └── hud.ts
│   ├── palette/
│   │   ├── palette.ts               command registry + execution
│   │   ├── builtins.ts              spawn/despawn/save/timescale/rebind
│   │   └── fuzzy.ts                 ranking
│   ├── storage/
│   │   ├── index.ts                 subpath: @f0rbit/forge/storage — store factory, slots, autosave, migrate (mem + file backends)
│   │   ├── store.ts
│   │   ├── slots.ts
│   │   ├── autosave.ts
│   │   └── migrate.ts
│   └── pixi/
│       ├── index.ts                 subpath: @f0rbit/forge/pixi — boot, sprite, camera, assets, input-browser, debug-pixi, palette-pixi, anim-pixi
│       ├── render.ts                Pixi Application bootstrap, render system
│       ├── sprite.ts                Sprite component bridge
│       ├── anim-pixi.ts             anim.sync system: pushes ECS frame -> Sprite.texture
│       ├── camera.ts                viewport / scaling
│       ├── assets.ts                Pixi Assets wrapper, Result-typed (incl. atlas loader)
│       ├── input-browser.ts         DOM + Gamepad InputSource
│       ├── debug-pixi.ts            Pixi Graphics-backed debug renderer
│       └── palette-pixi.ts          Pixi Text-backed palette overlay
├── test/                            bun test (mirrors src/ tree; integration-first)
│   ├── unit/
│   └── integration/
└── dist/                            rolldown output; .gitignored, included in published tarball
    ├── index.js + index.d.ts
    ├── pixi/index.js + index.d.ts
    ├── debug/index.js + index.d.ts
    ├── storage/index.js + index.d.ts
    └── presets/index.js + index.d.ts
```

Game repos are completely separate and consume `@f0rbit/forge` via npm:

```
~/dev/coin-collector/                a game repo (separate from forge)
├── package.json                     dependencies: { "@f0rbit/forge": "^0.1", "pixi.js": "^8" }
├── tsconfig.json
└── src/
    ├── main.ts                      pixi entry — imports from "@f0rbit/forge" + "@f0rbit/forge/pixi"
    ├── headless.ts                  bun-test entry — imports from "@f0rbit/forge" only
    ├── components.ts                game-specific Component<T> definitions
    ├── systems/
    └── replays/                     *.replay.json fixtures (per-game; see OQ-7)
```

No game source lives in the forge repo. The first game (`coin-collector`) is its own repo and validates the public API end-to-end during Phase 6 (see §9).

### Single package, multiple subpath exports (chosen)

We ship one npm package `@f0rbit/forge` with multiple subpath exports rather than splitting into `@f0rbit/forge`, `@f0rbit/forge-pixi`, `@f0rbit/forge-storage`, etc.

| Approach | Pros | Cons |
|---|---|---|
| **Single package, subpaths (chosen)** | atomic versioning; one release flow; one changelog; tree-shaking handles unused-subpath cost; one `AGENTS.md`; matches user intent ("its own package") | renderer-agnostic consumers still install the whole tarball (mitigated: dist subpaths are independent files, peer-dep on pixi keeps installed weight low) |
| Multiple packages | renderer-agnostic consumers can skip `forge-pixi` | versions desync; coordinated releases are friction; multi-package monorepo overhead for a one-author project |

The subpath layout above (`.`, `./pixi`, `./debug`, `./storage`, `./presets`) is the public API surface. Each is a separate Rolldown entry; tree-shaking does the rest.

### Dependency direction (strict)

Internal direction inside the forge repo:

```
src/pixi/*  ──► src/index, src/anim, src/snapshot, ...     (and pixi.js as a peer dep)
src/debug/* ──► src/index, src/world                        (no pixi imports)
src/storage/* ──► src/index, src/snapshot, @f0rbit/corpus  (no pixi imports)
src/presets/* ──► src/input/*                              (no pixi imports)
src/index, src/input/*, src/anim, src/snapshot, src/replay ──► (corpus, zod)
                                                                 ^^^^^^^^^^^^
                                                                 no pixi anywhere outside src/pixi/
```

Hard rules:
- The non-pixi tree (`src/index.ts`, `src/world.ts`, `src/schedule.ts`, `src/input/`, `src/debug/`, `src/storage/`, `src/presets/`, `src/anim.ts`, `src/snapshot.ts`, `src/replay.ts`) imports nothing renderer-related. CI lint check: any `pixi.js` / `@pixi/*` import outside `src/pixi/` fails the build.
- `src/pixi/` is the **only** directory that may import `pixi.js`. PIXI is a **peer dependency** of `@f0rbit/forge` declared with a wide range; consumers install pixi themselves.
- `src/storage/` depends on `src/snapshot.ts` for the `WorldSnapshot` type and on `@f0rbit/corpus` for the backing store.
- `@f0rbit/corpus` and `zod` are regular dependencies. `pixi.js` is a peer dependency.
- Test helpers (`harness`, `scripted-source`, `snapshot-diff`) live under `test/` and are not part of the published surface.

### What lives where (decision rationale)

| Concern | Subpath | Why |
|---|---|---|
| ECS / schedule / time / rng / resources | `@f0rbit/forge` (main) | pure logic, must be testable headless |
| Action layer + bindings | `@f0rbit/forge` (main) | bindings are data; the *source* is what changes |
| Presets (movement2d, platformer, ...) | `@f0rbit/forge/presets` | shipped in-package (OQ-2 resolved); separate subpath keeps the main entry slim |
| Browser input source (DOM + Gamepad) | `@f0rbit/forge/pixi` | DOM-coupled |
| Scripted input source | `@f0rbit/forge` (main) | no DOM; pure data driven |
| Debug data model + queueing + inspector + hud | `@f0rbit/forge/debug` | shipped in-package (OQ-1 resolved); separate subpath so production builds drop it via tree-shaking + `__DEV__` define |
| Debug renderer (Pixi Graphics) | `@f0rbit/forge/pixi` | actually draws lines/text |
| Palette registry + parsing + fuzzy | `@f0rbit/forge` (main) | pure data structures |
| Palette overlay (DOM/Pixi text) | `@f0rbit/forge/pixi` | UI presentation |
| Snapshot encode/decode | `@f0rbit/forge` (main) | needs Zod, no PIXI |
| Save slots, autosave, migration, mem+file backends | `@f0rbit/forge/storage` | wraps corpus; used by both headless tests and the running game |
| `anim` component + `anim.advance` (frame ticker) | `@f0rbit/forge` (main) | pure ECS state; deterministic; testable headless |
| `assets.atlas` loader + `anim.sync` (texture binding) | `@f0rbit/forge/pixi` | needs `Spritesheet` from PIXI |
| Astro/Solid embed | game repo (or `forbit-astro`) | not part of the engine package; embeds are per-game |

---

## 4. API surface walkthrough

The naming overrides are locked in here. **All examples below use the canonical API shape.** When implementing, no longer-form `setX(world, ...)` accessors are introduced.

### 4.1 World

```ts
// src/world.ts

export type Id = number & { readonly __id: unique symbol }
export type Component<T> = { readonly key: symbol; readonly name: string }

export const component = <T>(name: string): Component<T> => ({ key: Symbol(name), name })

export type Query<C extends readonly Component<any>[]> = {
  each: (fn: (id: Id, ...data: ComponentTuple<C>) => void) => void
  collect: () => Array<readonly [Id, ...ComponentTuple<C>]>
}

export type World = {
  spawn: <C extends ComponentBag>(...components: C) => Id
  despawn: (id: Id) => Result<void, EngineError>
  has: (id: Id, c: Component<any>) => boolean
  get: <T>(id: Id, c: Component<T>) => Result<T, EngineError>
  set: <T>(id: Id, c: Component<T>, data: T) => Result<void, EngineError>
  remove: (id: Id, c: Component<any>) => Result<void, EngineError>
  query: <C extends readonly Component<any>[]>(cs: C, opts?: QueryOpts) => Query<C>
  count: () => number
}

export const world = (): World => { /* factory: closes over Sets/Maps */ }
```

Usage:

```ts
const pos = component<{ x: number; y: number }>("pos")
const vel = component<{ dx: number; dy: number }>("vel")

const w = world()
const player = w.spawn([pos, { x: 0, y: 0 }], [vel, { dx: 1, dy: 0 }])

w.query([pos, vel] as const).each((id, p, v) => {
  p.x += v.dx
  p.y += v.dy
})
```

| Member | Semantics |
|---|---|
| `world()` | factory, returns a fresh world record |
| `spawn(...c)` | creates an entity with given components, returns its `Id` |
| `despawn(id)` | removes the entity and all its components |
| `has(id, c)` | does the entity have this component |
| `get(id, c)` / `set(id, c, data)` | typed component accessors, return Result |
| `remove(id, c)` | removes a single component |
| `query(cs)` | returns a Query iterable; `each()` is the hot loop, `collect()` for tests |
| `count()` | total entity count |

Notes:
- Spawn args are `[Component, Data]` tuples to keep type inference single-word. We considered `spawn({pos: {...}, vel: {...}})` but it loses the `Component<T>` brand.
- Iteration order is insertion order (Map iteration is spec-stable). Determinism contract relies on this.

### 4.2 Schedule

```ts
// src/schedule.ts

export type Stage = "startup" | "pre" | "update" | "post" | "render" | (string & {})
export type System = (w: World, ctx: Ctx) => void
export type Ctx = { time: Time; input: Input; debug: Debug; rng: Rng; res: Resources }

export type Schedule = {
  add: (stage: Stage, system: System, name?: string) => Schedule  // chainable
  remove: (name: string) => Schedule
  tick: (w: World, ctx: Ctx) => void                                // runs all stages once
  run: (stage: Stage, w: World, ctx: Ctx) => void                   // runs one stage
  stages: () => readonly Stage[]
}

export const schedule = (): Schedule => { /* factory */ }
```

Default stage order: `startup` (once on `tick` if not yet run) → `pre` → `update` → `post` → `render`. `render` is skipped when running headless (`schedule.run("update", ...)`).

| Member | Semantics |
|---|---|
| `add(stage, sys, name?)` | append system to stage; insertion-ordered execution |
| `remove(name)` | remove by name (used by palette `unload-system`) |
| `tick(w, ctx)` | one full frame: all stages in order |
| `run(stage, w, ctx)` | one stage in isolation (test driver, replay) |

### 4.3 Time

```ts
// src/time.ts

export type Time = {
  readonly fixed_dt: number          // seconds per simulation step (default 1/60)
  readonly tick: number              // simulation tick count (monotonic)
  readonly elapsed: number           // total simulated seconds
  readonly alpha: number             // 0..1 interpolation factor for render
  readonly scale: number             // 1.0 = realtime, 0.5 = slo-mo, 2.0 = ff
  advance: (real_dt: number) => number   // returns number of fixed steps consumed
  setScale: (s: number) => void
}

export const time = (opts?: { fixed_dt?: number }): Time => { /* factory */ }
```

The host loop calls `time.advance(real_dt_from_raf)` and then runs the schedule once per consumed step. `time.alpha` is read by `render` systems for interpolation.

### 4.4 Rng

```ts
// src/rng.ts

export type Rng = {
  readonly seed: number
  next: () => number          // [0, 1)
  int: (min: number, max: number) => number   // inclusive
  pick: <T>(arr: readonly T[]) => Result<T, EngineError>
  fork: (label: string) => Rng                // deterministic sub-stream
  state: () => number                          // serializable
  restore: (state: number) => void
}

export const rng = (seed: number): Rng => { /* mulberry32 or xoshiro */ }
```

`fork` is the determinism trick: AI gets `rng.fork("ai")`, particles get `rng.fork("fx")`. Two streams cannot interfere.

### 4.5 Resources

```ts
// src/resources.ts

export type ResKey<T> = symbol & { readonly __res: T }
export const resource = <T>(name: string): ResKey<T> => Symbol(name) as ResKey<T>

export type Resources = {
  set: <T>(k: ResKey<T>, v: T) => void
  get: <T>(k: ResKey<T>) => Result<T, EngineError>
  has: (k: ResKey<any>) => boolean
  remove: (k: ResKey<any>) => void
}

export const resources = (): Resources => { /* factory */ }
```

Branded symbols give us type-safe globals without a `Map<string, unknown>` cast soup.

### 4.6 Input — first-class subsystem

This is the load-bearing API. Three layers.

#### Layer 1: `RawInput` (sources produce, action layer consumes)

```ts
export type RawInput =
  | { kind: "key.down"; code: KeyCode; t: number }
  | { kind: "key.up"; code: KeyCode; t: number }
  | { kind: "mouse.down"; button: 0 | 1 | 2; x: number; y: number; t: number }
  | { kind: "mouse.up"; button: 0 | 1 | 2; x: number; y: number; t: number }
  | { kind: "mouse.move"; x: number; y: number; t: number }
  | { kind: "wheel"; dx: number; dy: number; t: number }
  | { kind: "pad.button.down"; pad: 0|1|2|3; button: PadButton; t: number }
  | { kind: "pad.button.up"; pad: 0|1|2|3; button: PadButton; t: number }
  | { kind: "pad.axis"; pad: 0|1|2|3; axis: PadAxis; value: number; t: number }
```

#### Layer 2: `InputSource` provider

```ts
export type InputSource = {
  drain: () => readonly RawInput[]   // returns raw events accumulated since last drain
  start?: () => void                  // browser source: attach listeners
  stop?: () => void                   // browser source: detach
}
```

Implementations:
- `browserSource()` — DOM + Gamepad API, lives in `src/pixi/input-browser.ts`
- `scriptedSource(events: RawInput[])` — replay or test, lives in `engine`
- `actionSource(events: ActionEvent[])` — replay from semantic actions, also in `engine` (see replay)

#### Layer 3: `Input` — the action layer (what game code uses)

```ts
export type Action = string  // e.g. "move.left", "jump", "interact"

export type Trigger =
  | { kind: "key"; code: KeyCode }
  | { kind: "mouse"; button: 0|1|2 }
  | { kind: "pad.button"; pad?: number; button: PadButton }
  | { kind: "pad.axis"; pad?: number; axis: PadAxis; threshold?: number; sign?: 1 | -1 }

export type Bindings = {
  digital: Record<Action, Trigger[]>           // many-to-one
  axes: Record<Action, AxisBinding[]>          // axis actions like "move.x"
  deadzone: number                              // global, 0.15 default
}

export type Input = {
  bind: (b: Bindings) => void
  bindings: () => Bindings                      // for save/load
  pressed: (a: Action) => boolean               // currently held this frame
  just: (a: Action) => boolean                  // pressed this frame, released previously
  released: (a: Action) => boolean              // released this frame
  axis: (a: Action) => number                   // -1..1 (analog or digital-as-axis)
  vector: (x: Action, y: Action) => readonly [number, number]
  pump: (raw: readonly RawInput[]) => void      // schedule's "pre" stage calls this
  source: (s: InputSource) => void              // swap source (replay)
}

export const input = (initial?: Bindings): Input => { /* factory */ }
```

Usage in a system:

```ts
import { input } from "@f0rbit/forge"
import { presets } from "@f0rbit/forge/presets"

const i = input(presets.movement2d)              // wasd + arrows + left stick
i.bind({ ...i.bindings(), digital: { ...i.bindings().digital, jump: [{ kind: "key", code: "Space" }] } })

const move_system: System = (w, { input, time }) => {
  const [dx, dy] = input.vector("move.x", "move.y")
  if (input.just("jump")) { /* trigger jump */ }
}
```

#### Presets

Shipped in-package under the `@f0rbit/forge/presets` subpath (OQ-2 resolved — see §9), importable as `presets.*`:

| Preset | Actions | Defaults |
|---|---|---|
| `presets.movement2d` | `move.x`, `move.y` | WASD + arrows + left-stick X/Y |
| `presets.movement8way` | `move.left/right/up/down` | digital, WASD + arrows + d-pad |
| `presets.platformer` | `move.x`, `jump`, `crouch`, `interact` | WASD + Space + S + E + face buttons |
| `presets.twinstick` | `move.x`, `move.y`, `aim.x`, `aim.y`, `fire` | WASD + mouse / dual sticks |
| `presets.menu` | `up/down/left/right`, `confirm`, `cancel`, `back` | arrows + Enter/Esc + d-pad/A/B |

OQ-2 is resolved (see §9): presets ship in-package on the `/presets` subpath.

#### Why this shape

- Tests bind action streams (`scriptedActionSource`), never raw key codes. Rebinding `KeyA` → `KeyZ` doesn't break a single test.
- Analog and digital share the same call site through `axis()` (digital triggers report ±1, analog reports raw).
- `vector(x, y)` is a one-line idiom for the most common case.
- `bind`/`bindings` are pure data — persist via `@f0rbit/forge/storage` (`store.bindings.save(i.bindings())`).

### 4.7 Replay

```ts
// src/replay.ts

export type ActionEvent =
  | { kind: "press"; action: Action; tick: number }
  | { kind: "release"; action: Action; tick: number }
  | { kind: "axis"; action: Action; value: number; tick: number }

export type Replay = {
  record: () => void                            // start capturing actions
  stop: () => readonly ActionEvent[]            // stop and return the trace
  play: (events: readonly ActionEvent[]) => InputSource  // returns a source to swap in
  save: (events: readonly ActionEvent[]) => string       // JSON
  load: (json: string) => Result<readonly ActionEvent[], EngineError>
}

export const replay = (i: Input): Replay => { /* factory, attaches to input */ }
```

Replays are over **actions**, not raw input. This is the determinism contract: a replay JSON is portable across rebindings, across browsers, across platforms.

### 4.8 Debug

```ts
// src/debug/debug.ts

export type Color = string  // CSS-ish: "red", "#ff0", "rgba(...)"

export type Debug = {
  enabled: () => boolean
  toggle: () => void
  // one-frame world-space shapes
  line: (a: Vec2, b: Vec2, color?: Color) => void
  circle: (c: Vec2, r: number, color?: Color) => void
  rect: (x: number, y: number, w: number, h: number, color?: Color) => void
  // entity decorations
  label: (id: Id, text: string, opts?: { offset?: Vec2; color?: Color }) => void
  pin: (id: Id, getter: () => string) => void          // updates each frame
  bounds: (id: Id, color?: Color) => void              // draws AABB if entity has a bounds component
  // hud counters
  counter: (name: string, value: number | string) => void
  // inspector
  select: (id: Id | null) => void
  selected: () => Id | null
  // queue access (for renderer)
  drain: () => readonly DebugCmd[]
}

export const debug = (): Debug => { /* factory */ }
```

The `@f0rbit/forge/debug` subpath writes `DebugCmd[]` into an internal queue per frame. The `@f0rbit/forge/pixi` debug renderer drains and paints. In headless tests, debug calls are no-ops (or recorded to a buffer for assertion).

Build flag: a `__DEV__` constant (set via Bun's `define`) wraps the entire debug write path so production builds tree-shake to nothing.

### 4.9 Palette

```ts
// src/palette/palette.ts

export type CommandArg =
  | { name: string; type: "string"; required?: boolean }
  | { name: string; type: "number"; required?: boolean; min?: number; max?: number }
  | { name: string; type: "bool"; required?: boolean }
  | { name: string; type: "id"; required?: boolean }       // entity id
  | { name: string; type: "enum"; values: readonly string[]; required?: boolean }

export type Command = {
  name: string                                              // "spawn", "save"
  description: string
  args: readonly CommandArg[]
  run: (parsed: Record<string, unknown>, ctx: Ctx) => Promise<Result<string, CommandError>>
}

export type Palette = {
  register: (c: Command) => void
  unregister: (name: string) => void
  list: () => readonly Command[]
  search: (q: string) => readonly Command[]                // fuzzy ranked
  exec: (line: string, ctx: Ctx) => Promise<Result<string, CommandError>>
  history: () => readonly string[]
  toggle: () => void
  open: () => boolean
}

export const palette = (): Palette => { /* factory */ }
```

Built-in commands (registered by `engine` on init):

| Command | Args | Purpose |
|---|---|---|
| `spawn <archetype>` | name | spawn a registered archetype at cursor |
| `despawn` | (selected entity) | remove selected |
| `save <slot>` | slot:enum | trigger `store.save(slot)` |
| `load <slot>` | slot:enum | `store.load(slot)` |
| `snap` | — | one-off snapshot to memory |
| `pause` / `resume` | — | toggles `time.scale` between 0 and 1 |
| `time <scale>` | scale:number | set `time.scale` (slo-mo / ff) |
| `bind <action> <trigger>` | action, trigger | rebind |
| `debug [on/off]` | bool? | toggle debug overlay |
| `inspect [id]` | id? | select entity |
| `set <res> <value>` | res, value | mutate a resource |

Games extend with `palette.register(...)`. Fuzzy search uses a small Sublime-style scorer (no external dep).

### 4.10 Store (`@f0rbit/forge/storage`)

Built **on top of corpus**. Corpus already provides:
- typed `Store<T>` with `put`/`get`/`get_latest`/`list`
- backends: `create_memory_backend`, `create_file_backend`, `create_cloudflare_backend`, `create_layered_backend`
- content-hash dedup, lineage via `parents`, tags, versioning
- `Result<T, CorpusError>` everywhere

We do **not** reimplement any of that. The `/storage` subpath wraps it to give game code a single-word API.

**v1 backends ship `mem` and `file` only** (OQ-3 resolved — see §9). IndexedDB / R2 / D1 are post-v1; the `Store<T>` interface is designed so adding a third backend is a new file, not an interface change.

```ts
// src/storage/store.ts

export type Slot = string                         // "auto", "slot-1", ...
export type Snap<T> = { meta: SnapshotMeta; data: T }

export type EngineStore = {
  // game world snapshots
  save: (slot: Slot, snapshot: WorldSnapshot, opts?: { tag?: string }) => Promise<Result<SnapshotMeta, StoreError>>
  load: (slot: Slot) => Promise<Result<WorldSnapshot, StoreError>>
  history: (slot: Slot) => AsyncIterable<SnapshotMeta>     // versioned via corpus
  // engine config (binding profile, debug prefs)
  bindings: { save: (b: Bindings) => Promise<Result<void, StoreError>>;
              load: () => Promise<Result<Bindings, StoreError>> }
  prefs: { save: (p: Prefs) => Promise<Result<void, StoreError>>;
           load: () => Promise<Result<Prefs, StoreError>> }
  // raw access if needed
  corpus: () => Corpus
}

export const store = (opts: StoreOpts): EngineStore => { /* factory wrapping corpus */ }
```

Construction:

```ts
import { create_corpus, create_memory_backend, define_store, json_codec } from "@f0rbit/corpus"

const s = store({
  backend: create_memory_backend(),                   // or create_file_backend({...})
  schemas: { world: WorldSnapshotSchema, bindings: BindingsSchema, prefs: PrefsSchema },
  game_id: "coin-collector",
})

await s.save("slot-1", world.snap())
const loaded = await s.load("slot-1")
```

v1 backends pass through directly:

| Use | Corpus backend (v1) |
|---|---|
| Tests | `create_memory_backend()` |
| Local desktop game | `create_file_backend({ root: "~/.local/share/<game>/" })` |
| Steam (Tauri, deferred — OQ-10) | `create_file_backend()` against Tauri's app-data dir |

#### Post-v1 backends (deferred)

| Use | Backend | Status |
|---|---|---|
| itch.io / `forbit-astro` browser embed | `create_indexeddb_backend()` | **Deferred to post-v1** (OQ-3). v1 browser embeds either run without persistence or proxy through a parent host. |
| Cloud sync | `create_cloudflare_backend({ d1, r2 })` or `create_layered_backend([memory, cloudflare])` | post-v1 |

#### Storage interface extensibility

The `EngineStore` factory takes any `Backend<T>` from corpus (current shape: `put`/`get`/`get_latest`/`list`/`get_meta`/`delete` returning `Result<T, CorpusError>`). Adding a browser persistence backend post-v1 is a single new file:

```ts
// future: src/storage/backend-idb.ts (or contributed upstream to corpus)

export const create_indexeddb_backend = (opts: IdbOpts): Backend<unknown> => { /* ... */ }

// game code; nothing else changes:
import { store } from "@f0rbit/forge/storage"
import { create_indexeddb_backend } from "@f0rbit/forge/storage/idb"  // future subpath
const s = store({ backend: create_indexeddb_backend({ db: "coin-collector" }), schemas, game_id })
```

The `EngineStore` type, the `save`/`load`/`history`/`bindings`/`prefs` methods, the slot semantics, and the migration chain stay identical. This is the contract OQ-3 keeps open: ship two backends now, slot a third in later without API churn.

Save-slot abstraction is just a corpus tag (`tags: ["slot:auto"]` or `tags: ["slot:1"]`); `history(slot)` lists snapshots filtered by that tag.

Migration: each schema carries a `version` field. On `load`, we pipe through a migration chain. Schemas live in `src/storage/migrate.ts`.

### 4.11 Snapshot

```ts
// src/snapshot.ts

export type WorldSnapshot = {
  version: 1
  seed: number
  rng_state: number
  tick: number
  elapsed: number
  entities: readonly EntitySnap[]
  resources: Record<string, unknown>
}

export type EntitySnap = { id: number; components: Record<string, unknown> }

export const snap = (w: World, ctx: Ctx, schema: SchemaRegistry): Result<WorldSnapshot, EngineError>
export const restore = (snap: WorldSnapshot, schema: SchemaRegistry): Result<World, EngineError>
```

`SchemaRegistry` maps `Component<T>` → Zod schema, used for validated encode/decode. Components without registered schemas are skipped (logged in debug, not an error — useful for runtime-only state like Pixi sprite handles).

### 4.12 Assets (`@f0rbit/forge/pixi`)

```ts
// src/pixi/assets.ts

import type { Spritesheet, Texture } from "pixi.js"

export type Assets = {
  load: <T = unknown>(alias: string, url: string) => Promise<Result<T, AssetError>>
  loadMany: (entries: Record<string, string>) => Promise<Result<Record<string, unknown>, AssetError>>
  atlas: (alias: string, url: string) => Promise<Result<Spritesheet, AssetError>>   // typed atlas loader
  texture: (alias: string) => Result<Texture, AssetError>                            // convenience getter
  get: <T>(alias: string) => Result<T, AssetError>
  has: (alias: string) => boolean
}

export const assets = (): Assets => { /* wraps Pixi's Assets module, Result-typed */ }
```

Single-word, Result-typed; no surprise throws. The implementation wraps PIXI's loader with `try_catch_async` from corpus.

`assets.atlas(alias, url)` is a typed alias for loading a TexturePacker-style JSON atlas. Internally it calls PIXI's `Assets.load`, asserts the resolved value is a `Spritesheet` (it is when the JSON is paired with a sibling image per the TexturePacker convention PIXI auto-detects), and returns it Result-wrapped. The call site is self-documenting and the return type is statically known — preferred over generic `assets.load<Spritesheet>(...)` for atlases. Generic `assets.load` remains for arbitrary resources.

### 4.13 Anim — sprite animation

Sprite animation is a first-class engine subsystem because every 2D game needs it, the wrap over PIXI's `Spritesheet` is thin, and frame timing is on the determinism critical path — it must run off ECS time, not PIXI's internal ticker. See §5.E for the deep-dive.

```ts
// src/anim.ts

export type AnimData = {
  atlas: string       // alias of a loaded Spritesheet
  sequence: string    // animation name within the atlas (atlas.animations[sequence])
  frame: number       // current frame index (0-based, within the sequence)
  t: number           // accumulated seconds within the current frame
  speed: number       // multiplier; 1.0 = atlas-defined fps, 2.0 = double speed
  loop: boolean       // wrap on completion vs hold on last frame
  done: boolean       // true on the tick a one-shot finished; cleared on next play()
}

export const anim_c: Component<AnimData> = component<AnimData>("anim")

export type Anim = {
  // ECS frame ticker (engine-side, deterministic). Registered into the schedule "update" stage.
  advance: System
  // helpers, mirroring world.* / time.* shape
  play: (w: World, id: Id, sequence: string, opts?: { speed?: number; loop?: boolean }) => Result<void, EngineError>
  stop: (w: World, id: Id) => Result<void, EngineError>
  is_playing: (w: World, id: Id) => boolean
}

export const anim = (): Anim => { /* factory */ }
```

Usage:

```ts
import { anim, anim_c } from "@f0rbit/forge"
import { assets, sprite_c } from "@f0rbit/forge/pixi"

const a = assets()
await a.atlas("player", "/sprites/player.json")

const an = anim()
sch.add("update", an.advance, "anim.advance")

const id = w.spawn(
  [sprite_c, { atlas: "player", frame: "idle_0" }],
  [anim_c,   { atlas: "player", sequence: "idle", frame: 0, t: 0, speed: 1, loop: true, done: false }],
)

an.play(w, id, "run", { speed: 1.25, loop: true })
if (an.is_playing(w, id)) { /* ... */ }
```

| Member | Semantics |
|---|---|
| `anim_c` | the `Component<AnimData>` brand; spawn / `world.set` with this |
| `anim().advance` | system: per-entity, accumulates `time.fixed_dt * speed` into `t`, advances `frame` when frame duration elapsed, sets `done` and (for non-loop) freezes on the last frame |
| `anim().play(w, id, seq, opts?)` | resets `frame=0`, `t=0`, `done=false`, sets `sequence/speed/loop`. Errors if entity has no `anim_c` |
| `anim().stop(w, id)` | sets `done=true`, freezes frame; equivalent to pause-on-last for queries |
| `anim().is_playing(w, id)` | `has(anim_c) && !done` |

The PIXI-side counterpart `anim.sync` lives in `src/pixi/anim-pixi.ts`; it queries `(sprite_c, anim_c)` and pushes `atlas.textures[frame_name]` onto the live `Sprite.texture`. It runs in the `render` stage and is skipped headlessly. See §5.E.

---

## 5. Subsystem deep-dives

### A. Input + keymapping

#### Why action-first

Every game systems book ends up here. The user's tests must outlive their bindings. Mapping `KeyA` -> `move.left` once, then writing 50 tests that say `i.pressed("move.left")`, means a rebind is data-only.

#### Composition

```
[browserSource | scriptedSource | actionSource]   ──drain()──►   Input.pump(raw[])
                                                                       │
                                          digital + axis bindings   ───┤
                                                                       ▼
                                              action state (pressed / just / released / axis)
```

`Input.pump` is called by the `pre` stage system. It:
1. drains raw events from the active source
2. applies bindings to derive action transitions
3. updates internal `pressed`/`prev`/`axis` maps
4. emits `ActionEvent[]` to the replay recorder if active

Action state is **frame-coherent**: `just(action)` means "transitioned to pressed this frame, regardless of how many physical events occurred."

#### Gamepad specifics

- `navigator.getGamepads()` is polled in `browserSource.start()`; we deduce pad button + axis transitions per-frame and synthesize `RawInput` events with monotonic timestamps.
- Up to 4 pads (`pad: 0|1|2|3`). Bindings can be pad-agnostic (`pad: undefined` matches any) or pad-pinned.
- Deadzone applied per-axis at the binding layer, not the source — sources stream raw values.

#### Rebinding

```ts
const b = i.bindings()
i.bind({
  ...b,
  digital: { ...b.digital, jump: [{ kind: "key", code: "Space" }, { kind: "pad.button", button: "south" }] },
})
await s.bindings.save(i.bindings())
```

Persisted via `@f0rbit/forge/storage`. On game start: `s.bindings.load()` then `i.bind(...)`.

#### Tested how

```ts
import { scripted, replay, world, schedule, input } from "@f0rbit/forge"
import { presets } from "@f0rbit/forge/presets"

test("jump action triggers exactly once on key down", () => {
  const w = world(), sch = schedule(), i = input(presets.platformer)
  const src = scripted([
    { kind: "key.down", code: "Space", t: 0 },
    { kind: "key.up",   code: "Space", t: 16 },
  ])
  i.source(src)
  // ...drive schedule.tick, assert i.just("jump") on tick 1, i.pressed("jump") false on tick 2
})
```

### B. Debug rendering

#### Two-tier model

1. **Headless (engine):** `Debug` is a buffer. Calls push commands. `drain()` returns them. Tests can assert "this frame, did the AI draw a line to its target?"
2. **Pixi (`@f0rbit/forge/pixi`):** `src/pixi/debug-pixi.ts` instantiates a `PIXI.Container` over the world view; on each `render` stage call, it drains the debug buffer and emits `Graphics` and `Text` instances for that frame, then clears.

#### Inspector

`debug.select(id)` sets the selected entity. The inspector overlay (Pixi-side) reads it:
- enumerates components on the entity (via a private `world.components_of(id)` accessor)
- for each component, checks the Zod schema registry for a "shape"
- renders a JSON-ish tree, with primitive fields editable (number/bool/string)
- edits round-trip through `world.set(...)`

Click selection: a Pixi system on the `pre` stage reads cursor + a hit-test against entities with a `Bounds` component.

#### HUD

Always-on counters: `fps`, `tick`, `entities`, `time.scale`. Plus arbitrary `debug.counter(name, value)` calls.

#### Toggles

Bound to actions via the `presets.debug`:

| Action | Default | Function |
|---|---|---|
| `debug.toggle` | `F1` | overall debug overlay |
| `debug.inspect` | `F2` | inspector |
| `debug.step` | `F3` | one-step pause/advance |
| `debug.palette` | backtick | open command palette |

`@f0rbit/forge/storage` persists the user's overrides in prefs.

#### Production gating

`src/debug/debug.ts` exports both `debug()` (full) and `debug_noop()` (zero-cost stub matching the same interface). Rolldown's `define: { __DEV__: "true" | "false" }` swaps which one `src/debug/index.ts` re-exports. The `@f0rbit/forge/pixi` debug renderer lives on its own subpath, so production bundles that don't import `/debug` (or set `__DEV__ = false`) drop it via tree-shaking.

### C. Command palette

#### Lifecycle

1. User binds `debug.palette` action (default backtick) -> `palette.toggle()`
2. Palette reads its own input via the action layer
3. Typed text is parsed into `name [args...]`
4. On Enter: `palette.exec(line, ctx)` -> `Result<string, CommandError>`
5. Result rendered in palette overlay

#### Parser

Simple shell-like splitter (whitespace, quoted strings). Each declared `CommandArg` is coerced and validated. Parse failures are `CommandError.kind: "parse"`.

#### Fuzzy search

Local-only: a Sublime-style score (consecutive char bonus, start-of-word bonus). No external dep. Returns top N for live preview.

#### Built-ins extensibility

The `engine` registers built-ins on init. Games can `palette.unregister("save")` and re-register with custom slot logic.

### D. Persistence — the corpus binding

`@f0rbit/corpus` already does almost everything we need. The plan is **no fork, no upstream contribution; consume directly.** Reasons:

- `Store<T>` with `put/get/get_latest/list/get_meta/delete` is exactly what save slots want.
- Memory + file + cloudflare backends cover dev / desktop / future cloud sync.
- Content-hash dedup is free win for big saves.
- `parents: ParentRef[]` gives us autosave lineage for free (each autosave references the previous).
- `tags` cleanly model save slots (`tags: ["slot:auto"]`).
- `Result<T, CorpusError>` matches our error model.

#### What is NOT in corpus and we must build (v1)

| Need | Status | Where |
|---|---|---|
| `WorldSnapshot` schema | new | `src/snapshot.ts` |
| Component-schema registry (Zod) | new | `src/snapshot.ts` |
| Save slots layered on tags | thin wrapper | `src/storage/slots.ts` |
| Autosave (interval / event) | new | `src/storage/autosave.ts` |
| Schema migration chain | new | `src/storage/migrate.ts` |

#### Browser persistence — deferred (OQ-3 resolved)

v1 ships `mem` + `file` backends only. Browser embeds (itch.io, `forbit-astro`) run without engine-managed persistence in v1; if a game needs save data in-browser, the host page can pass a JSON blob in/out via postMessage / Astro props until the IndexedDB backend lands.

The user owns `@f0rbit/corpus` and may add an `IndexedDBBackend` upstream when post-v1 work begins. From the engine side it slots in via the extension point documented in §4.10 — no API churn for game code, no breaking change to `EngineStore`. Corpus is pre-1.0 (`0.0.1` per package.json), so upstreaming is cheap when we get there.

The R2 / D1 cloud-sync backends remain post-v1 as previously planned.

#### Migration

```ts
type WorldSnapshotV1 = { version: 1; ... }
type WorldSnapshotV2 = { version: 2; ... }

const migrations: Migration[] = [
  { from: 1, to: 2, run: (v1: WorldSnapshotV1): WorldSnapshotV2 => { /* ... */ } },
]

s.load("slot-1")  // internally pipes through migrations to current version
```

Every shipped game pins its current version. `load` returns `MigrationError` if the on-disk version is *newer* than the binary (forward-compat is the user's problem).

### E. Sprite animation

#### Why this is in the engine

Originally framed as game-level. Reversed because:
- **Universal:** every 2D game has at least one animated sprite. There is no game in the user's roadmap that doesn't.
- **Determinism critical path:** PIXI ships `AnimatedSprite` with a `play()` method, but it ticks on PIXI's internal `Ticker` (real wall-clock). Using it would silently break the determinism contract — a recorded replay would resolve to different frames depending on requestAnimationFrame jitter. Animation timing has to be ECS-driven.
- **Thin wrap:** ~80 LOC across two systems. The cost of putting it in the engine is well below the cost of every game reimplementing the same frame ticker incorrectly.

#### Three-layer model

```
[atlas asset (Spritesheet JSON + image)]   ← assets.atlas("player", url)
                ▼
[ECS state: anim component { sequence, frame, t, speed, loop, done }]   ← anim.advance(w, ctx) each tick
                ▼
[PIXI binding: sprite.texture = atlas.textures[frame_name]]              ← anim.sync(w, ctx) on render stage
```

Layer 1 lives in `src/pixi/` (PIXI's `Spritesheet` is the parsed atlas). Layer 2 lives in `src/anim.ts` (pure data, no PIXI import). Layer 3 lives in `src/pixi/`. The `anim` component itself is just data — it survives snapshot/restore and replays exactly.

#### Why we don't use PIXI's `AnimatedSprite.play()`

`AnimatedSprite` is a `Sprite` subclass with an internal frame counter ticked by PIXI's `Ticker`. The ticker runs on rAF and reflects real wall-clock time. Two consequences make it unusable here:

1. **Non-deterministic.** Two replays of the same input stream resolve to different `currentFrame` values depending on browser/render load.
2. **Decoupled from `time.scale`.** Slo-mo / fast-forward (`palette.exec("time 0.25", ...)`) wouldn't slow animations.

We therefore use plain `Sprite` instances and drive `sprite.texture` ourselves from the ECS frame state. The `AnimatedSprite` class is never imported.

#### Frame timing model

- The atlas JSON declares per-frame durations (TexturePacker emits `meta.frameTags` + per-frame `duration` in ms when configured for animation export; PIXI's `Spritesheet` parses these into `data.animations` — names → frame textures — and the per-frame durations are read from the raw JSON via `spritesheet.data.frames[frame_name].duration`).
- `anim.advance` runs in the `update` stage. For each `(anim_c)`-bearing entity:
  ```
  t += time.fixed_dt * anim.speed
  while t >= duration_of(current_frame):
    t -= duration_of(current_frame)
    frame += 1
    if frame >= sequence.length:
      if anim.loop: frame = 0
      else: frame = sequence.length - 1; done = true; break
  ```
- `anim.speed` is a unitless multiplier on simulated time. `0.5` halves animation rate; `2.0` doubles it. It composes cleanly with `time.scale` because `time.fixed_dt` already reflects scale-free simulation steps and time scaling is handled at the loop boundary.

#### One-shot vs looping

- **Looping** (`loop: true`): wraps `frame` to 0 indefinitely. `done` stays `false`.
- **One-shot** (`loop: false`): on the tick the last frame finishes, `frame` clamps to the last index and `done` is set to `true`. The entity holds on the last frame visually until `play()` is called again or the component is removed.
- Game systems can poll `anim.is_playing(w, id)` or query `(anim_c)` and filter by `data.done` to react to completion (e.g., advance a state machine when the death animation finishes).

#### Events integration

`anim.advance` writes to a per-tick event buffer accessible via `res.get(anim_events)`:

```ts
type AnimEvent = { id: Id; kind: "finished" | "looped"; sequence: string; tick: number }
```

- `"finished"` — emitted when a one-shot's `done` transitions false → true.
- `"looped"` — emitted when a looping animation wraps past its last frame.

Buffer is cleared at the start of each `update` stage. Game code queries it from any `update`-stage system. This avoids polling `done` flags across thousands of entities.

#### Fallback / missing-frame behaviour

Three failure modes, all non-throwing:

| Condition | Behaviour |
|---|---|
| `atlas` alias not loaded | `anim.advance` no-ops for that entity; `debug.counter("anim.missing_atlas", ++)` increments. `anim.sync` paints a 16×16 magenta-and-black checker placeholder texture (built into `@f0rbit/forge/pixi` as a baked data URI; same source as the `__default__` atlas, OQ-12). |
| `sequence` name absent on the atlas | same as above; `debug.counter("anim.missing_sequence", ++)`; placeholder texture. |
| Frame duration missing in atlas JSON | falls back to a default of `1/12` seconds (12 fps). Logged once per atlas via `debug.counter`. |

We never throw and never break the schedule. A missing asset visually screams (the magenta checker) so the user catches it, but the game keeps running and replays remain deterministic.

#### How replay tests verify animation state

Animation state is part of the ECS world snapshot, so existing replay determinism tests cover it transitively:

```ts
test("run cycle frame state is deterministic across replays", () => {
  const h = harness(game)
  h.drive(replay_actions)
  h.tick(120)  // 2 seconds at 60Hz
  const state = w.get(player_id, anim_c).expect()
  expect(state.frame).toBe(3)        // run frame 3 at tick 120
  expect(state.sequence).toBe("run")
  expect(state.done).toBe(false)
})
```

The `replay-determinism.test.ts` world-hash assertion already covers `anim` data fields because they're plain numbers + strings in the snapshot — no special handling needed.

#### Whole-tick vs sub-tick durations (open question, see OQ-11)

Atlas frames may declare durations that don't divide evenly by `fixed_dt` (e.g., 100ms frame at 1/60s = 6 ticks, but a 75ms frame is 4.5 ticks). Two strategies:

- **Whole-tick (recommended for v1):** quantise frame durations to `Math.round(duration_ms / 1000 * fixed_dt_hz)` ticks. Deterministic by construction (no float `t` accumulation), simpler to reason about, sufficient for almost all hand-authored sprite work.
- **Sub-tick:** keep `t` as accumulated seconds, compare against frame's exact duration in ms. Higher fidelity for art with carefully tuned timings but introduces floating-point accumulator state into the determinism contract (still deterministic across runs on same arch, but a class of subtle bugs we don't want in v1).

Recommended: ship whole-tick. Quantisation happens once at atlas load time (cached on the parsed `Spritesheet`); the runtime never sees milliseconds.

#### Default placeholder atlas (nice-to-have)

`@f0rbit/forge/pixi` ships a built-in `__default__` atlas: a 4-frame 16×16 sequence (magenta/cyan/yellow/black) embedded as a data URI. Games can spawn entities with `anim_c({ atlas: "__default__", sequence: "spin", ... })` for prototyping before art exists. ~30 lines of inline JSON + base64. See OQ-12 (resolved: shipped).

#### Atlas format

We standardise on **TexturePacker JSON-Hash** (PIXI's default `Spritesheet` format), with frame durations declared in the per-frame `duration` field. Other formats (Aseprite native, free-tex-packer arrays, LDtk autotile) are **out of scope** — the user converts to TexturePacker JSON. Documented in §10 risks and a future "tooling" note in `AGENTS.md`.

### F. Astro embed

The Astro embed is **not part of `@f0rbit/forge`** — it lives in the consumer site (`forbit-astro`) so the engine package ships zero Astro/Solid dependencies. The pattern below is what `forbit-astro` will copy in during Phase 7.

```tsx
// forbit-astro/src/components/GameEmbed.solid.tsx

import { onMount, onCleanup } from "solid-js"
import { boot } from "@f0rbit/forge/pixi"

export default function GameEmbed(props: { src: string; width?: number; height?: number }) {
  let host!: HTMLDivElement
  let stop: (() => void) | null = null

  onMount(async () => {
    const game = await import(/* @vite-ignore */ props.src)
    stop = await boot(host, game.default)
  })
  onCleanup(() => stop?.())

  return <div ref={host} class="game-embed" style={{ width: `${props.width ?? 640}px`, height: `${props.height ?? 360}px` }} />
}
```

```astro
---
// forbit-astro/src/components/GameEmbed.astro
import GameEmbed from "./GameEmbed.solid"
const { src, width, height } = Astro.props
---
<GameEmbed client:visible src={src} width={width} height={height} />
```

`client:visible` so the engine doesn't boot until scrolled into view — important on a content-heavy site like `forbit-astro`. Game bundles are dynamic-imported per embed (the game repo's `bun run build` output drops into `forbit-astro` either as an Astro asset import or via an `<iframe>`; that decision lands in Phase 7).

---

## 6. Testability strategy

### Test layout

All tests live in `~/dev/forge/test/`, mirroring `src/`:

```
test/
├── unit/
│   ├── rng.test.ts                  # mulberry32 determinism
│   ├── time.test.ts                 # accumulator math
│   ├── fuzzy.test.ts                # palette ranking
│   └── bindings.test.ts             # raw->action mapping
└── integration/
    ├── world-lifecycle.test.ts       # spawn/query/despawn workflows
    ├── schedule-stages.test.ts       # ordering, name removal
    ├── input-actions.test.ts         # scripted source -> action transitions
    ├── replay-determinism.test.ts    # record -> replay -> identical world hash
    ├── snapshot-roundtrip.test.ts    # snap/restore equality
    ├── palette-builtins.test.ts      # save/load/timescale/rebind round-trips
    ├── debug-headless.test.ts        # debug.line() recorded, drained, asserted
    ├── storage-slots.test.ts         # corpus memory-backed slot behavior
    ├── storage-autosave.test.ts      # interval autosaves, lineage chain
    ├── storage-migrate.test.ts       # v1 -> v2 -> v3 chain
    └── storage-file.test.ts          # file backend round-trip via temp dir
```

### Patterns

| Subsystem | Test pattern |
|---|---|
| World/Schedule/Time/Rng | direct integration; no mocks ever |
| Input | `scriptedSource(events)` provider; assert via `i.pressed/just/axis` |
| Replay | record from scripted source, play back, assert world snapshot hash equal |
| Storage | `create_memory_backend()` → behaves like the in-memory fake for downstream |
| Debug | drain the debug buffer; assert command sequence |
| Palette | `palette.exec("save slot-1", ctx)` returns `ok("Saved slot-1.")` |
| Anim (main entry) | stub atlas (in-memory frame-duration array); spawn `anim_c`; tick N; assert `frame`/`done`/event buffer |
| Anim (`/pixi` sync) | load real TexturePacker fixture via `assets.atlas`; tick; assert `sprite.texture === atlas.textures[expected_frame]` |
| Pixi rendering | NOT tested in `bun test` — see below |

### Headless harness

```ts
// test/helpers/harness.ts (not part of the published surface)

export const harness = (game: GameModule) => {
  const w = world(), sch = schedule(), t = time(), r = rng(game.seed ?? 1)
  const i = input(game.bindings ?? presets.movement2d)
  const d = debug(), p = palette(), res = resources()
  const ctx: Ctx = { time: t, input: i, debug: d, rng: r, res }
  game.setup({ world: w, schedule: sch, ...ctx })
  return {
    tick: (n = 1) => { for (let k = 0; k < n; k++) sch.tick(w, ctx) },
    step: (real_dt: number) => { t.advance(real_dt); sch.tick(w, ctx) },
    drive: (events: RawInput[]) => i.source(scripted(events)),
    world: w, schedule: sch, ctx,
  }
}
```

Every game's headless test boots through this harness (or its own copy of it) and never imports from `@f0rbit/forge/pixi`.

### What does NOT get tested under `bun test`

- PIXI rendering output. We ship a tiny visual-regression playground (a Bun script that boots the renderer, takes a `canvas.toDataURL()`, diffs against a baseline) — *post-v1*.
- Browser Gamepad polling. Manual smoke test only.
- Browser persistence. The IndexedDB backend is deferred to post-v1 (OQ-3); when it lands it'll use `fake-indexeddb` in tests with manual real-browser smoke checks.

### Determinism CI gate

Add `bun test --bail` job: run all replay tests with `random()` and `Date.now()` patched to throw if called from the non-pixi tree (`src/` minus `src/pixi/`). We monkey-patch in a test setup hook. Any leak fails the build.

---

## 7. Determinism contract

### What we guarantee

For a fixed `(seed, bindings, action_stream, fixed_dt, schedule)` tuple:
- world state at tick N is byte-identical across runs, machines, and platforms (within IEEE-754 float caveats — see below)
- `WorldSnapshot` JSON at any tick hashes identically

### What would break it

| Hazard | Mitigation |
|---|---|
| `Date.now()` in engine | banned. Time comes from `time.elapsed`. Lint rule + test-time monkeypatch trap. |
| `Math.random()` in engine | banned. Use `rng`. Lint rule. |
| Async timing inside systems | systems are sync. Async only at the loop boundary. |
| `Set<Id>` iteration order | stable in practice (insertion order in V8/JSC), documented and contract-tested |
| `Object.keys` order | for snapshot serialization we sort keys explicitly |
| Floating point cross-platform | same arch (browsers + Bun on x86/ARM): empirically stable for all four arithmetic ops. We don't use `Math.sin`/`cos` directly; if needed, supply a tabulated approximation. |
| Replay against rebound input | replays are over actions, not raw input; immune |
| Real wall-clock in autosave timing | autosave triggers off `time.elapsed`, not wall-clock |

### CI enforcement

- A `tools/no-throws.ts` script greps `src/` (excluding `src/pixi/`) for `Date.now`, `Math.random`, `throw `, `try {`, `catch (`, `setTimeout`, `setInterval`. Whitelist comment prefix `// non-deterministic-ok:` allowed only inside `src/pixi/`.
- The replay test suite runs each replay 3× and asserts identical world hashes.

---

## 8. Build & distribution

`@f0rbit/forge` is a published npm package. This section pins the build chain, the published surface, and the dev-loop story for working on the engine and a game in tandem.

### 8.1 Tooling — Rolldown

[Rolldown](https://rolldown.rs/) is the bundler. Justification:

- **Rust-fast.** Rolldown's own benchmark shows ~1.6s for a build that takes 40s under Rollup + esbuild. Cold builds are negligible; watch mode is sub-second.
- **Vite-aligned.** Rolldown is the unified bundler powering Vite 8+ and is built by the Vite team (VoidZero). Choosing it now keeps us inside the lane the user's other web work already lives in.
- **Rollup-compatible API.** `defineConfig`, `input`/`output`, plugins, `external` — same shape as Rollup, drop-in mental model.
- **esbuild feature parity.** Built-in TypeScript transform, `define`, sourcemaps — no separate transform pipeline.
- **ESM-first, multi-config.** A `defineConfig([...])` array runs multiple configurations in parallel; the natural fit for our subpath layout.

Rolldown is pre-1.0 (RC at time of writing). We pin a minor version and watch the changelog. If it stalls or breaks, the fallback is `tsup` (esbuild-based, library-mode out of the box). See risks (§11).

### 8.2 `package.json` shape

ESM-only. No CJS for v1 — Bun, modern Node, and the browser all consume ESM natively.

```jsonc
{
  "name": "@f0rbit/forge",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "files": ["dist", "README.md", "LICENSE"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./pixi": {
      "types": "./dist/pixi/index.d.ts",
      "import": "./dist/pixi/index.js"
    },
    "./debug": {
      "types": "./dist/debug/index.d.ts",
      "import": "./dist/debug/index.js"
    },
    "./storage": {
      "types": "./dist/storage/index.d.ts",
      "import": "./dist/storage/index.js"
    },
    "./presets": {
      "types": "./dist/presets/index.d.ts",
      "import": "./dist/presets/index.js"
    }
  },
  "dependencies": {
    "@f0rbit/corpus": "^0.0.x",
    "zod": "^3"
  },
  "peerDependencies": {
    "pixi.js": "^8"
  },
  "peerDependenciesMeta": {
    "pixi.js": { "optional": true }
  },
  "devDependencies": {
    "rolldown": "^1.0.0-beta",
    "typescript": "^5"
  },
  "scripts": {
    "build": "rolldown -c && tsc -p tsconfig.build.json",
    "build:watch": "rolldown -c --watch",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "release": "bun run build && changeset publish"
  }
}
```

`peerDependenciesMeta.pixi.js.optional = true` means non-pixi consumers (a headless test runner, a CI bot) install `@f0rbit/forge` without `pixi.js` and never load `dist/pixi/`. Tree-shaking handles the rest.

### 8.3 `rolldown.config.ts` — multi-entry library build

```ts
// rolldown.config.ts
import { defineConfig } from "rolldown"

const external = [
  "@f0rbit/corpus",
  "zod",
  "pixi.js",
  /^@pixi\//,
]

const entry = (name: string, path: string) =>
  defineConfig({
    input: { [name]: path },
    output: {
      dir: "dist",
      format: "esm",
      entryFileNames: "[name].js",
      sourcemap: true,
    },
    external,
    platform: "neutral",
  })

export default defineConfig([
  entry("index", "src/index.ts"),
  entry("pixi/index", "src/pixi/index.ts"),
  entry("debug/index", "src/debug/index.ts"),
  entry("storage/index", "src/storage/index.ts"),
  entry("presets/index", "src/presets/index.ts"),
])
```

Each subpath is its own configuration so they bundle in parallel and produce independent `dist/<subpath>/index.js` files matching the `exports` map. `external` stops Rolldown from inlining `@f0rbit/corpus`, `zod`, or `pixi.js` — they resolve at the consumer.

### 8.4 TypeScript declaration emission

Rolldown bundles JS; it does not currently emit `.d.ts`. Two options:

- **(a) `tsc --emitDeclarationOnly` after Rolldown.** Boring, well-understood, no plugin risk. Adds ~1–2s to the build. The chosen v1 approach.
- (b) A Rolldown DTS plugin. Faster in principle but the plugin ecosystem is still maturing; the risk-reward isn't there for v1.

`tsconfig.build.json` extends the root tsconfig with `compilerOptions: { declaration: true, emitDeclarationOnly: true, outDir: "dist" }` and `include: ["src"]`. The `build` script runs `rolldown -c && tsc -p tsconfig.build.json`; declaration files land in the same `dist/<subpath>/index.d.ts` paths the `exports` map points at.

### 8.5 Peer dependency policy

| Dependency | Type | Rationale |
|---|---|---|
| `pixi.js` | `peerDependencies` (optional, `^8`) | Renderer consumers install pixi themselves; non-pixi consumers skip the install entirely. Wide range so games can pin pixi independently of forge. |
| `@f0rbit/corpus` | `dependencies` | User-owned, pre-1.0, tightly coupled to forge's storage layer — pinning at the engine is correct. |
| `zod` | `dependencies` | Schemas are part of the public API surface (snapshot registry, store schemas). Forge declares the version it built against. |

If consumer-side zod version drift becomes a problem, promote zod to peer-dep. Not a v1 concern.

### 8.6 Versioning + release

[Changesets](https://github.com/changesets/changesets) in single-package mode handles version bumps + changelog. Workflow: `bun changeset` to record an intent, `bun changeset version` to apply, `bun run release` to publish. Manual `npm publish` to start; once cadence is established, wire to a GitHub Action with `NPM_TOKEN`. No prerelease channel for v1.

### 8.7 Watch-mode dev loop — engine + game in tandem

When working on `@f0rbit/forge` and a game repo simultaneously:

```fish
# terminal 1, in ~/dev/forge/
bun install
bun link                          # registers @f0rbit/forge as a global link
bun run build:watch               # rolldown --watch; rebuilds dist/ on src/ change

# terminal 2, in ~/dev/coin-collector/
bun install
bun link @f0rbit/forge            # consume the local linked build
bun run dev                       # game's dev script (vite, bun, whatever)
```

Rolldown's `--watch` rebuilds `dist/` on every save; the game's bundler picks up the new `dist/index.js` (or `dist/pixi/index.js`) on its next reload. Declaration files do *not* watch under `tsc --emitDeclarationOnly` — for type changes during dev, run `tsc -p tsconfig.build.json --watch` in a third terminal, or accept that types lag JS until the next full build.

Before pushing the game repo: `bun unlink @f0rbit/forge` then `bun install` to pin to the published version. A linked-but-unpublished forge is the easiest way to ship a broken local-only state — see risks (§11).

A future `forge:dev` script in the game's `package.json` could automate the link/unlink dance. Out of scope for v1, but noted.

---

## 9. Phased build plan

Sized so each phase is "one good day or two." LOC estimates assume tests included. The first five phases land entirely inside the forge repo; Phase 6 spins up the first game in its own repo and consumes forge via `bun link`; Phase 7 wires the bundled game into `forbit-astro`.

### Phase 0 — scaffold the forge repo (sequential)

| Task | LOC | Touches |
|---|---|---|
| `bun init` in `~/dev/forge/`; `package.json` with `name`, `type: module`, `exports` map, scripts | ~120 | root |
| `tsconfig.json` (root) + `tsconfig.build.json` (declaration-only) | ~40 | root |
| `rolldown.config.ts` (multi-entry, all five subpaths) | ~60 | root |
| `biome.json` + lint script enforcing import-direction rules (no `pixi.js` outside `src/pixi/`) | ~80 | tools/ |
| Subpath skeleton stubs (`src/index.ts`, `src/pixi/index.ts`, `src/debug/index.ts`, `src/storage/index.ts`, `src/presets/index.ts`) — empty barrels | ~40 | src/* |
| Test bootstrap: `bun test` config, sample smoke test | ~30 | test/ |
| Verify `bun run build` produces `dist/` with all five `index.js` + `index.d.ts`; `npm publish --dry-run` exits clean | ~0 | (verification) |

**Deliverable:** `bun run build` produces a publishable `dist/` covering all five subpaths with matching `.d.ts`; `npm publish --dry-run` reports the expected file list; `bun test` runs the smoke test; `bun run typecheck` clean.
**Parallelisable:** no — single coder, sequential. Phase 0 is more substantial than the previous monorepo scaffold because the build chain is real work.

### Phase 1 — engine core (the kernel)

| Task | LOC | Parallel? | Files |
|---|---|---|---|
| World (`src/world.ts`) + tests | ~250 | A | src/world.ts, test/integration/world-lifecycle |
| Schedule (`src/schedule.ts`) + tests | ~150 | B | src/schedule.ts, test/integration/schedule-stages |
| Time (`src/time.ts`) + tests | ~80 | C | src/time.ts, test/unit/time |
| Rng (`src/rng.ts`) + tests | ~100 | D | src/rng.ts, test/unit/rng |
| Resources (`src/resources.ts`) + tests | ~60 | E | src/resources.ts |
| `anim` component + `advance` system + tests (headless, no PIXI) | ~120 | F | src/anim.ts, test/integration/anim-advance |

**Deliverable:** a tiny "movement" example test spawns entities, runs systems, asserts positions after N ticks. Animation frame state advances deterministically against a stub atlas (in-memory frame-duration array; no PIXI dependency in the test).
**Parallel:** all 6 tasks independent (no shared files). Ideal `coder-fast` × 6 in worktrees. The `anim` task has no dependency on `world` because it only references `Component<T>` and `System` types via `import type`.

### Phase 2 — input + replay

| Task | LOC | Parallel? | Files |
|---|---|---|---|
| Raw + bindings + action layer | ~280 | sequential head | src/input/source.ts, bindings.ts, input.ts |
| Scripted source + action source | ~80 | A (after head) | src/input/scripted.ts |
| Presets (movement2d/8way/platformer/twinstick/menu) on `/presets` subpath | ~120 | B (after head) | src/presets/index.ts |
| Replay (record/play/save/load) + tests | ~180 | sequential tail | src/replay.ts |
| Determinism CI script | ~60 | tail | tools/no-throws.ts |

**Deliverable:** full replay test loop — record actions for 100 ticks, play back, world hash matches. Determinism CI gate green. `@f0rbit/forge/presets` exports working presets.

### Phase 3 — snapshot + storage (mem + file)

| Task | LOC | Parallel? | Files |
|---|---|---|---|
| `WorldSnapshot` + Zod registry + snap/restore | ~220 | A | src/snapshot.ts |
| `/storage` subpath skeleton + corpus dep | ~30 | sequential | src/storage/index.ts |
| `store()` factory wrapping corpus | ~140 | B (after skel) | src/storage/store.ts |
| Slots + autosave + migration | ~200 | C (after store) | src/storage/slots.ts, autosave.ts, migrate.ts |
| Tests: roundtrip (mem), file backend round-trip via temp dir, slots, autosave lineage, migrations | ~250 | follow-on | test/integration/storage-* |

**Deliverable:** save/load against memory + file backends. Bindings + prefs persist across "sessions". **IndexedDB explicitly excluded** (OQ-3) — the `Backend<T>` extension point is documented in §4.10 so post-v1 work is additive.

### Phase 4 — debug + palette (engine-side, no PIXI yet)

| Task | LOC | Parallel? | Files |
|---|---|---|---|
| `debug` factory + buffer + commands | ~200 | A | src/debug/debug.ts |
| Inspector data model | ~120 | B | src/debug/inspector.ts |
| HUD counters | ~60 | C | src/debug/hud.ts |
| `/debug` subpath barrel | ~10 | (follows A/B/C) | src/debug/index.ts |
| `palette` registry + parser + fuzzy | ~250 | D | src/palette/* |
| Built-in commands (save/load/time/bind/...) | ~180 | E (after palette) | src/palette/builtins.ts |
| Tests: drain assertions, palette exec roundtrips | ~180 | follow-on | test/integration/* |

**Deliverable:** headless game can run `palette.exec("save slot-1", ctx)`, run `palette.exec("time 0.25", ctx)`, drain `debug` commands and assert geometry. `@f0rbit/forge/debug` exports the full debug surface.

### Phase 5 — `@f0rbit/forge/pixi` + first npm release

| Task | LOC | Parallel? | Files |
|---|---|---|---|
| `/pixi` subpath skeleton + Pixi v8 peer-dep wiring | ~30 | sequential | src/pixi/index.ts |
| `render.ts` (Pixi `Application`, render system) | ~180 | A | src/pixi/render.ts |
| `sprite.ts` (Sprite component bridge) | ~120 | B | src/pixi/sprite.ts |
| `camera.ts` (viewport / scaling) | ~100 | C | src/pixi/camera.ts |
| `assets.ts` (Pixi Assets wrap, Result-typed) + `assets.atlas` typed loader + `__default__` placeholder atlas | ~170 | D | src/pixi/assets.ts |
| `anim-pixi.ts` (`anim.sync` system; integration test loading a real atlas) | ~80 | D2 (after assets) | src/pixi/anim-pixi.ts, test/integration/anim-pixi |
| `input-browser.ts` (DOM + Gamepad source, unified across pads) | ~250 | E | src/pixi/input-browser.ts |
| `debug-pixi.ts` (Graphics + Text drain) | ~220 | F | src/pixi/debug-pixi.ts |
| `palette-pixi.ts` (overlay UI) | ~250 | G | src/pixi/palette-pixi.ts |
| Changelog + first release: `bun changeset version` → `npm publish` v0.1.0 | ~20 | (release) | CHANGELOG.md |

**Deliverable:** `@f0rbit/forge` v0.1.0 published to npm. `import { boot } from "@f0rbit/forge/pixi"` spins up a real Pixi canvas, renders a moving sprite controlled by WASD + gamepad, with running animation cycle from a real atlas, F1 toggles debug, backtick opens palette. The `anim-pixi` integration test loads a fixture atlas via `assets.atlas` and asserts texture-binding behaviour against a real `Spritesheet` instance. The atlas loader + sync test runs under `bun test` with PIXI in headless mode (no canvas); rendering output is manual smoke.

### Phase 6 — first game (NEW REPO `~/dev/coin-collector/`)

| Task | LOC | Parallel? | Files |
|---|---|---|---|
| New repo init: `bun init` in `~/dev/coin-collector/`, `package.json` depending on `@f0rbit/forge` (linked locally), pixi installed | ~60 | sequential | (game repo) |
| Game shell (components, systems, level data) | ~400 | sequential | src/components.ts, src/systems/*, src/level.ts |
| Headless replay test (10s seed, score = N) | ~120 | follow-on | test/replay-coin.test.ts |
| Pixi entry (real renderer, asset list) | ~120 | follow-on | src/main.ts |
| Replay fixtures committed | ~3 files | follow-on | replays/*.replay.json |

**Deliverable:** playable game in a browser via `bun link @f0rbit/forge` during dev; `bun test` in the game repo runs the headless replay and asserts final score. Validates the published API surface end-to-end. Before tagging v0.1.0 of the game, switch from `bun link` to a pinned npm version of forge.

### Phase 7 — Astro embed in `forbit-astro`

| Task | LOC | Parallel? | Files |
|---|---|---|---|
| Build coin-collector to a single bundle (`bun run build` in coin-collector repo) | ~0 | sequential | (game side) |
| Decide: Astro asset import vs `<iframe>` embed | ~0 | (decision) | — |
| `<GameEmbed>` Astro component (Solid wrapper, `client:visible`, lazy-import) | ~120 | A | forbit-astro/src/components/GameEmbed.astro + .solid.tsx |
| One blog post / project page demo | ~50 | follow-on | forbit-astro/src/pages/* |

**Deliverable:** coin-collector renders inline on a forbit-astro page on `client:visible`, lazy-bundled. The embed component lives in `forbit-astro`, not in `@f0rbit/forge` — the engine package itself ships zero Astro/Solid dependencies.

### Future (post-v1, NOT scoped here)

- **IndexedDB backend** in `/storage` (resolves OQ-3's deferred half). Likely upstreamed to `@f0rbit/corpus` first.
- **R2 / D1 cloud-sync backends** through corpus's existing Cloudflare backend.
- **Visual regression** harness for Pixi.
- **Tauri** wrapper for itch + Steam.
- **Multiplayer**: Colyseus / PartyKit. Action streams travel as input, server replays authoritatively. Replay-determinism is the on-ramp; the architecture is built for it from day one.
- **Rollback netcode** (long shot).
- **Asset pipeline** if and only if a real game demands it.

---

## 10. Open questions

All 12 v1 open questions are resolved as of 2026-05-04. The original question + recommendation text is preserved below so the rationale stays visible; the **RESOLVED** line under each one captures the decision actually applied. New OQs may surface during phase work — log them here.

### OQ-1: `engine-debug` as its own package?

**Options:**
- (a) Inside `engine` (current plan). Pro: one less package, debug API can use internal world hooks freely. Con: production builds need the `__DEV__` define to tree-shake.
- (b) Sibling `engine-debug` package. Pro: clean dep direction, dropping it from production is just not depending on it. Con: requires public hooks on `world` (e.g. `world.components_of(id)`) that we'd otherwise keep internal.

**Recommendation:** (a). The `__DEV__` define is the cleaner production exit. Keep `world.components_of(id)` hidden behind a `__internal` symbol export.

**RESOLVED:** debug ships in-package on the `@f0rbit/forge/debug` subpath; `__DEV__` define handles tree-shaking for production builds.

### OQ-2: presets in `engine` or `engine-presets`?

**Options:**
- (a) Inside `engine` (current plan). Pro: zero-import friction (`import { presets } from "@games/engine"`). Con: more API surface in the kernel.
- (b) Sibling `engine-presets`. Pro: kernel stays small, presets evolve independently. Con: extra import in every game.

**Recommendation:** (a) for v1. If preset count grows past ~10, split.

**RESOLVED:** presets ship in-package on the `@f0rbit/forge/presets` subpath.

### OQ-3: IndexedDB backend — local or upstream to corpus?

Already discussed in 5.D. Original recommendation was "ship local first; promote to upstream after stabilization." Updated decision: **defer browser persistence entirely from v1.** Storage ships `mem` + `file` only; the `Backend<T>` extension point in `EngineStore` is documented (§4.10) so adding IndexedDB later is a new file, not an interface change. The user owns `@f0rbit/corpus` and may add the backend upstream when post-v1 work begins; either way the engine-side API does not move.

**RESOLVED:** deferred to post-v1. v1 ships `mem` + `file` backends. Storage interface stays open for a third backend without API churn.

### OQ-4: `assets` Result-typed vs throw-typed?

PIXI's Assets module throws. We have two choices:
- (a) Wrap each call in `try_catch_async`, return `Result<T, AssetError>`. Per the project conventions, this is correct.
- (b) Lift to throws at the engine-pixi boundary (PIXI is "the absolute boundary").

**Recommendation:** (a). The engine-pixi assets adapter is the boundary; the API outside it must be Result-typed.

**RESOLVED:** Result-typed assets. PIXI's throws are caught at the `src/pixi/assets.ts` boundary via `try_catch_async`; everything outside that file consumes `Result<T, AssetError>`.

### OQ-5: snapshot format — JSON or binary?

JSON for v1. Binary (CBOR / MessagePack) when JSON proves too slow for the user's largest world. Carrying the version field means we can swap formats without a flag day.

**RESOLVED:** JSON for v1. The `snap` / `restore` interfaces and the `WorldSnapshot.version: 1` field are explicit extensibility hooks — a future binary codec swaps in by bumping `version` and registering a new (de)serializer behind the same `Result<WorldSnapshot, EngineError>` boundary; no game-side code changes.

### OQ-6: Bun-native vs ESM-portable build for distribution?

If the user wants to publish `@forbit/engine` to npm later, we need an ESM build step. For v1 (private workspace), `main: "src/index.ts"` works directly via Bun. Original recommendation was **defer**; the user has now committed to publishing as `@f0rbit/forge` from day one. See §8 for the full build chain.

**RESOLVED:** ship as a single npm package `@f0rbit/forge` with subpath exports, built by **Rolldown**. ESM-only. Declarations via `tsc --emitDeclarationOnly`. Pixi as peer-dep. See §8 for the full build & distribution spec.

### OQ-7: where do replay JSON files live in source?

Current plan: `games/<game>/replays/*.replay.json`, committed. Alternative: dedicated `replays/` workspace. **Recommendation:** colocate with the game. Replay drift signals game logic drift.

**RESOLVED:** replays live per-game in their own repos at `<game-repo>/replays/*.replay.json`. Follows directly from OQ-6 — there is no monorepo to host a shared `replays/` workspace, and replay drift remains tied to game logic drift in the same repo.

### OQ-8: input source per-pad or unified?

Current plan: one `browserSource` handles all 4 pads. Alternative: one source per pad. **Recommendation:** unified; pad index travels in the event.

**RESOLVED:** unified gamepad source. Single `browserSource()` polls `navigator.getGamepads()` for all four slots; pad index travels in each `RawInput` event.

### OQ-9: what's a Component<T> identity — symbol or string?

Plan: `symbol` for runtime identity, `name: string` carried for serialization. Alternative: string only. **Recommendation:** symbol + name; allows distinct `pos` components in two games to coexist if the engine is ever loaded twice (unlikely but cheap).

**RESOLVED:** symbol for runtime identity, `name: string` carried alongside for serialization. Matches §4.1.

### OQ-10: Tauri wrapper — package or per-game?

**Defer.** When Steam ship is real, decide.

**RESOLVED:** deferred. Revisit when a Steam release becomes real work.

### OQ-11: Anim — sub-tick frame durations or whole-tick quantisation?

**Options:**
- (a) Whole-tick (current recommendation, see §5.E). Quantise atlas frame durations to integer ticks at load time. No floating-point accumulator state. Simpler determinism story; sufficient for hand-authored sprite art.
- (b) Sub-tick. Keep `t` as accumulated seconds and compare against frame duration in milliseconds. Higher fidelity for art with carefully tuned timings. Adds a float to the determinism contract (still deterministic across runs on same arch, but more surface for subtle bugs).

**Recommendation:** (a) for v1. Revisit if the user ships a game whose art demands timings that don't quantise cleanly to 60 Hz.

**RESOLVED:** whole-tick quantisation. Atlas frame durations are quantised to integer ticks at load time; `t` accumulates as integer ticks, never seconds.

### OQ-12: Built-in default placeholder atlas?

Should `engine-pixi` ship a `__default__` atlas (4-frame 16×16, magenta/cyan/yellow/black, baked as a data URI) so games can spawn animated entities before art exists?

**Options:**
- (a) Ship it. ~30 LOC inline JSON+base64. Friction-free prototyping; obvious "this is a placeholder" colours.
- (b) Don't. Game authors load their own placeholder atlas if they want one.

**Recommendation:** (a). Cheap, removes a per-game chore, and the placeholder texture for missing-asset fallback (§5.E) shares the same baked image — single source.

**RESOLVED:** ship the `__default__` placeholder atlas inside `@f0rbit/forge/pixi`. Same baked data URI also serves the missing-asset fallback path.

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **PIXI v8 API churn** | medium | medium | encapsulate in `src/pixi/render.ts` and `assets.ts`; peer-dep pinned to a single major (`^8`) |
| **Browser Gamepad API quirks** (Safari edge cases, polling cost) | high | low | feature-detect; allow disabling; document tested browsers |
| **Save format migration pain** | medium | high | version field from day one; integration tests for v1→v2; never reuse a version. v1 surface area is smaller than the original plan because IndexedDB is deferred — fewer cross-backend edge cases to migrate. |
| **Determinism leaks** | medium | high | CI grep for `Date.now`/`Math.random` outside `src/pixi/`; replay-3× test; quarantine browser non-det in `src/pixi/` |
| **`@f0rbit/corpus` pre-1.0 breakage** | medium | medium | user owns corpus; pin a known-good version; tests catch breakage |
| **Rolldown maturity** (pre-1.0 RC) | medium | medium | pin a specific minor version; monitor changelog; fallback to `tsup` (esbuild library mode) if Rolldown blocks a release. The build config is small enough (~60 LOC) that swapping is a couple-hour job, not a refactor. |
| **Multi-repo dev friction** (engine + game via `bun link`) | high | medium | document the `bun link` / `bun unlink` workflow in §8.7; before pushing the game repo always switch to the pinned npm version; consider a `forge:dev` script post-v1 to automate. Easy failure mode: shipping a game that depends on local engine changes never released to npm. |
| **Published-package maintenance burden** | medium | medium | owning a published package is more burden than an internal monorepo (changelog discipline, semver, deprecation cycles, npm token rotation). Mitigation: changesets handles changelog mechanics; v0.x semantics keep us free to break things until the API settles. |
| **Engine maintenance burden vs using Phaser** | high | varies | accept it; this is a deliberate choice. Tracked outside this doc. |
| **Replay determinism cross-platform** (ARM Bun vs x86 browser) | low | high | float ops are stable across modern IEEE-754 impls; avoid `Math.sin` in engine; add cross-arch CI later |
| **Solid + Astro hydration edge cases for embeds** | low | low | embed lives in `forbit-astro`, not in the engine package; `client:visible` only, single-component shape, manual smoke before each release |
| **Bundle size** (Pixi v8 is ~200kb gzipped) | medium | medium | pixi as peer-dep keeps the engine tarball small; lazy-import the game bundle via `client:visible`; document target sizes |
| **Atlas format fragmentation** (TexturePacker JSON-Hash vs Aseprite vs free-tex-packer arrays vs LDtk) | medium | low | canonical format is **TexturePacker JSON-Hash** (PIXI's native `Spritesheet` format) with per-frame `duration`. Other tools' outputs are out-of-scope for v1; the user converts before loading. Documented at the call site of `assets.atlas`. |
| **PIXI's `AnimatedSprite` accidentally adopted** | low | high | `src/pixi/` never imports `AnimatedSprite`; lint rule greps for the symbol inside `src/pixi/` and fails the build. Replays would silently desync if it slipped in. |

---

## Suggested AGENTS.md updates (when project bootstraps)

Two `AGENTS.md` files are now in scope: one in the forge repo, one per game repo.

### `~/dev/forge/AGENTS.md` (engine package)

- Repo shape: single published package, subpath layout under `src/` (`.`, `./pixi`, `./debug`, `./storage`, `./presets`).
- Build chain: **Rolldown** for JS bundling, `tsc --emitDeclarationOnly` for `.d.ts`. ESM-only. `bun run build` produces `dist/`.
- Subpath-export discipline: every public entry point is one of the five subpaths. New surface goes through a deliberate `exports` map edit; nothing is exported by accident.
- Peer-dep policy: `pixi.js` is peer (optional), `@f0rbit/corpus` and `zod` are direct. Document why and don't drift.
- Lint rules: no `pixi.js` / `@pixi/*` imports outside `src/pixi/`; no `Date.now` / `Math.random` / `setTimeout` / `setInterval` / `throw` / `try` outside `src/pixi/`. The `tools/no-throws.ts` script enforces both.
- Naming overrides specific to this project (single-word `world.*`, `time.*`; records-of-functions; no classes).
- Determinism contract + the three-banned-globals rule.
- Testing: integration-first under `test/`; helpers in `test/helpers/` (not part of the published surface).
- Release flow: changesets, single-package mode, manual `npm publish` (later: GitHub Action).
- Pointer to this scoping doc as the canonical design source until v1 ships.

### `~/dev/<game>/AGENTS.md` (per-game)

- How to consume `@f0rbit/forge`: which subpaths to import, peer-dep installation (`bun add pixi.js`).
- Local dev workflow: `bun link @f0rbit/forge` while the engine is in flux; `bun unlink @f0rbit/forge` + pinned version before tagging the game.
- Game-specific component schemas live in `src/components.ts`; the headless harness in `test/` drives `bun test`.
- Replay fixtures live in `replays/`; replay drift signals game-logic drift (don't blindly regenerate).
- Where bindings/prefs/saves live in corpus terms (`tags: ["slot:..."]`).

---

## Appendix A — module quickref

```ts
// canonical imports inside a game

import {
  world, schedule, time, rng, resources, component,
  input, replay,
  anim, anim_c,
  palette,
  snap, restore,
} from "@f0rbit/forge"

import { presets } from "@f0rbit/forge/presets"
import { debug } from "@f0rbit/forge/debug"
import { store } from "@f0rbit/forge/storage"
import { boot, assets, sprite, sprite_c, camera } from "@f0rbit/forge/pixi"
```

```ts
// canonical headless game module (lives in the GAME repo, not in forge)

import type { GameModule } from "@f0rbit/forge"
import { presets } from "@f0rbit/forge/presets"

const game: GameModule = {
  id: "coin-collector",
  seed: 1,
  bindings: presets.movement2d,
  schemas: { /* component -> Zod */ },
  setup: ({ world, schedule, time, input, debug, rng, res }) => {
    // spawn initial entities, register systems, register palette commands
  },
}

export default game
```

```ts
// canonical pixi entry (lives in the GAME repo)

import { boot } from "@f0rbit/forge/pixi"
import game from "./headless"
import assetList from "./assets"

boot(document.getElementById("game")!, { ...game, assets: assetList })
```
