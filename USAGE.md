# `@f0rbit/forge` — Usage Guide

> Comprehensive reference for **`@f0rbit/forge` v0.1.4**. Code samples are valid TypeScript against the actually-shipped surface. For design rationale see [`PLAN.md`](./PLAN.md); for breaking changes see [`CHANGELOG.md`](./CHANGELOG.md).

## Table of Contents

1. [Quick start](#1-quick-start)
2. [Core concepts](#2-core-concepts)
   - 2.1 [World](#21-world)
   - 2.2 [Components](#22-components)
   - 2.3 [Queries](#23-queries)
   - 2.4 [Schedule](#24-schedule)
   - 2.5 [Time](#25-time)
   - 2.6 [RNG](#26-rng)
   - 2.7 [Resources](#27-resources)
   - 2.8 [Ctx](#28-ctx)
3. [Input](#3-input)
   - 3.1 [The action-first model](#31-the-action-first-model)
   - 3.2 [Presets](#32-presets)
   - 3.3 [Custom bindings](#33-custom-bindings)
   - 3.4 [Querying actions](#34-querying-actions)
   - 3.5 [Input sources](#35-input-sources)
   - 3.6 [Rebinding at runtime](#36-rebinding-at-runtime)
4. [Replay](#4-replay)
   - 4.1 [What's recorded](#41-whats-recorded)
   - 4.2 [Recording](#42-recording)
   - 4.3 [Playback](#43-playback)
   - 4.4 [Format](#44-format)
   - 4.5 [Save/load](#45-saveload)
   - 4.6 [Replays as test fixtures](#46-replays-as-test-fixtures)
5. [Storage / persistence](#5-storage--persistence)
   - 5.1 [Snapshot model](#51-snapshot-model)
   - 5.2 [The snapshotter](#52-the-snapshotter)
   - 5.3 [`take` / `restore` round-trip](#53-take--restore-round-trip)
   - 5.4 [`Store<T>` interface](#54-storet-interface)
   - 5.5 [Backends — `mem` and `file`](#55-backends--mem-and-file)
   - 5.6 [`EngineStore` composite](#56-enginestore-composite)
   - 5.7 [Future backends](#57-future-backends)
6. [Debug](#6-debug)
   - 6.1 [Frame-buffer shapes](#61-frame-buffer-shapes)
   - 6.2 [Per-entity pins](#62-per-entity-pins)
   - 6.3 [Inspector](#63-inspector)
   - 6.4 [HUD stats](#64-hud-stats)
   - 6.5 [`__DEV__` gating](#65-__dev__-gating)
7. [Palette](#7-palette)
   - 7.1 [Toggling](#71-toggling)
   - 7.2 [Built-in commands](#72-built-in-commands)
   - 7.3 [Registering custom commands](#73-registering-custom-commands)
   - 7.4 [Search and history](#74-search-and-history)
8. [PIXI integration](#8-pixi-integration)
   - 8.1 [`boot(opts)`](#81-bootopts)
   - 8.2 [Camera modes](#82-camera-modes)
   - 8.3 [`pixel_perfect` and `smoothing`](#83-pixel_perfect-and-smoothing)
   - 8.4 [Resize](#84-resize)
   - 8.5 [Two-stage render flow](#85-two-stage-render-flow)
   - 8.6 [Asset loading](#86-asset-loading)
   - 8.7 [Sprite component](#87-sprite-component)
   - 8.8 [Anim component](#88-anim-component)
9. [Test harness](#9-test-harness)
10. [Determinism contract](#10-determinism-contract)
11. [Cookbook](#11-cookbook)
12. [Troubleshooting / gotchas](#12-troubleshooting--gotchas)
13. [Extending forge](#13-extending-forge)
14. [Deployment](#14-deployment)
15. [Versioning](#15-versioning)
16. [Reference — exports table](#16-reference--exports-table)

---

## 1. Quick start

```sh
bun add @f0rbit/forge
bun add pixi.js   # only needed for @f0rbit/forge/pixi
```

Subpath exports:

```ts
import { /* engine core */ } from "@f0rbit/forge";
import { presets }            from "@f0rbit/forge/presets";
import { /* debug types */ }  from "@f0rbit/forge/debug";
import { engine_store }       from "@f0rbit/forge/storage";
import { boot, sprite_c }     from "@f0rbit/forge/pixi";
```

Minimal "hello sprite" — under 30 lines:

```ts
import { component, pos_c } from "@f0rbit/forge";
import { boot, sprite_c }   from "@f0rbit/forge/pixi";
import { presets }          from "@f0rbit/forge/presets";

const player_c = component<true>("player");

const r = await boot({
  mount: "#root",
  window: { width: globalThis.innerWidth, height: globalThis.innerHeight },
  camera: { design: { width: 320, height: 180 }, mode: "letterbox" },
  bindings: presets.movement2d,
});
if (!r.ok) throw new Error(`boot failed: ${r.error.kind}`);
const app = r.value;

app.world.spawn(
  [pos_c, { x: 160, y: 90 }],
  [player_c, true],
  [sprite_c, { texture: "__default__", frame: "__default_0__", anchor: { x: 0.5, y: 0.5 } }],
);

app.schedule.add("update", (w, ctx) => {
  const [dx, dy] = ctx.input.vector("move.x", "move.y");
  for (const [, p] of w.query([pos_c, player_c] as const)) {
    p.x += dx * 60 * ctx.time.fixed_dt;
    p.y += dy * 60 * ctx.time.fixed_dt;
  }
}, "player.move");

app.start();
```

For a real, end-to-end consumer with replay tests, level setup, persistence, and a build pipeline, see the **`coin-collector`** repo (the canonical example):

- `src/main.ts` — pixi bootstrap
- `src/plugin.ts` — `(world, schedule) => void` install pattern
- `src/level.ts` — startup system spawning entities
- `src/systems/movement.ts` + `src/systems/collection.ts` — gameplay systems
- `tools/record-win.ts` — recording a deterministic replay from headless
- `test/replay.test.ts` — replay-as-fixture pattern

---

## 2. Core concepts

### 2.1 World

The `World` is a sparse-set ECS keyed by integer entity ids. Components are stored per-key; queries walk the smallest store first.

```ts
import { world, component, pos_c, type Id } from "@f0rbit/forge";

const vel_c = component<{ dx: number; dy: number }>("vel");

const w = world();

const e: Id = w.spawn(
  [pos_c, { x: 0, y: 0 }],
  [vel_c, { dx: 1, dy: 0 }],
);

w.has(e, vel_c);            // → true
const r = w.get(e, pos_c);  // → Result<{ x, y }, EngineError>
if (r.ok) r.value;          // → { x: 0, y: 0 }

w.set(e, pos_c, { x: 5, y: 0 });
w.remove(e, vel_c);
w.despawn(e);
w.count();                  // → 0
```

| Method | Signature | Notes |
|---|---|---|
| `spawn` | `(...c: [Component<T>, T][]) => Id` | Returns a fresh integer id. |
| `spawn_at` | `(id: Id, ...c) => void` | Used by snapshot restore — preserves the id. Bumps `next_id` if greater. |
| `despawn` | `(id) => Result<void, EngineError>` | Removes from every store. |
| `has` | `(id, c) => boolean` | Pure check, no allocation. |
| `get` | `(id, c) => Result<T, EngineError>` | `kind: "component_missing"` if absent. |
| `set` | `(id, c, data) => Result<void, EngineError>` | Adds the component if not present and bumps the version. Errors `entity_not_found` if despawned. |
| `remove` | `(id, c) => Result<void, EngineError>` | Errors `component_missing` if not present. |
| `query` | `(cs, opts?) => Query<C>` | See §2.3. |
| `count` | `() => number` | Live entity count. |

### 2.2 Components

A `Component<T>` is a typed descriptor. The runtime identity is a **shared global symbol** (`Symbol.for(...)`), so two `component<T>("name")` calls in different bundles produce identical keys.

```ts
import { component, type Component } from "@f0rbit/forge";

const hp_c: Component<{ value: number; max: number }> = component("hp");
const tag_c: Component<true>                          = component("tag");
```

**Why `Symbol.for`?** Before v0.1.2 the engine used `Symbol(...)` (unique per call). When a consumer's code and the `pixi` subpath bundle both imported `pos_c`, they got *different* symbols and queries silently saw zero matches. Black screen. The fix is the global registry — `component("foo") === component("foo")` (their `key` symbols match) is now true. Any `Component<T>` you define participates automatically.

**`_c` suffix convention.** The codebase suffixes component descriptors with `_c` (`pos_c`, `vel_c`, `sprite_c`, `anim_c`) to disambiguate the descriptor from the data. The data type itself drops the suffix. The convention is enforced by code review, not the type system.

**Canonical exports:**

| Export | Subpath | Shape |
|---|---|---|
| `pos_c` | `@f0rbit/forge` | `Component<{ x: number; y: number }>` |
| `anim_c` | `@f0rbit/forge` | `Component<AnimData>` |
| `sprite_c` | `@f0rbit/forge/pixi` | `Component<SpriteData>` |

`pos_c` is shared so the PIXI sprite-sync and anim-sync systems can find positions without asking your game for a custom component name. You can override via `boot({ pos: my_pos_c })` if you want a different shape, but every `coin-collector`-style game just uses `pos_c`.

### 2.3 Queries

`world.query` returns a **generator-backed view** over the underlying stores. Three ways to consume it:

```ts
const q = w.query([pos_c, vel_c] as const);

// 1. for...of (live iterator)
for (const [id, p, v] of q) {
  p.x += v.dx;  // safe: in-place updates of existing components
}

// 2. .each callback
q.each((id, p, v) => { p.x += v.dx; });

// 3. .collect() snapshot
for (const [id, p, v] of q.collect()) {
  if (p.x > 100) w.despawn(id);  // safe — the array was captured first
}
```

**Mutation safety:** `set`-ting the same entity in a component already in the iterator is fine. Adding/removing the *keyset* — `despawn`, `remove`, or `set` on a *new* entity for one of the iterated components — invalidates the iterator. Always `.collect()` before structural mutation.

In `__DEV__` builds, the iterator tracks the version of every iterated store. If it changes mid-iteration, you get:

```
[forge] world.query([pos, coin]) iterator detected mid-iteration mutation.
Snapshot via .collect() before mutating to avoid undefined behaviour.
```

Production builds (`NODE_ENV=production` or `globalThis.__DEV__ = false`) skip the check entirely.

The canonical *collect-then-mutate* pattern from `coin-collector/src/systems/collection.ts`:

```ts
export const collection_system: System = (w, ctx) => {
  const players = w.query([pos_c, player_c] as const).collect();
  if (players.length === 0) return;
  const score = ctx.res.get(score_r);
  if (!score.ok) return;

  for (const [, pp] of players) {
    for (const [cid, cp] of w.query([pos_c, coin_c] as const).collect()) {
      const dx = pp.x - cp.x;
      const dy = pp.y - cp.y;
      if (dx * dx + dy * dy <= radius_sq) {
        w.despawn(cid);
        score.value.value += 10;
      }
    }
  }
};
```

**Query options** — `without` excludes entities that have any of the listed components:

```ts
const dead = w.query([pos_c] as const, { without: [alive_c] }).collect();
```

### 2.4 Schedule

Stages run in a fixed order each tick: `startup → pre → update → post → render`. `startup` runs once on the first `tick`. The other four run every tick in insertion order.

```ts
import { schedule } from "@f0rbit/forge";

const sch = schedule();

sch.add("startup", spawn_level,   "level.setup");
sch.add("update",  player_input,  "player.input");
sch.add("update",  movement,      "movement");
sch.add("post",    collisions,    "collisions");
sch.add("render",  draw_overlays, "ui.overlays");

sch.tick(world, ctx);  // pumps input + runs every stage in order
```

Inside `sch.tick`:

1. `startup` runs once.
2. `ctx.input.advance(world, ctx)` — drains the input source, refreshes action state, fires `pre_advance` and `on_advance` listeners (replay hooks live here).
3. `pre`, `update`, `post`, `render` run in that order. After the `render` stage, `ctx.debug.frame()` is automatically drained (so debug commands always render in the same tick they're issued).

`sch.run(stage, world, ctx)` runs one stage in isolation — useful inside the harness `tick` for headless tests that don't want PIXI render systems to fire.

**Pump auto-firing:** the schedule fires `input.advance` before stages and `debug.frame()` after `render` automatically. You don't add input or debug systems by hand — the schedule does it.

The `startup_done` flag is per-`schedule()` instance; if you `clear()` the world via `snapshotter.restore`, startup will not re-fire (this matches "loaded a save → don't re-spawn the level"). Recreate the schedule if you want a fresh startup pass.

### 2.5 Time

Forge's clock is a **fixed-timestep accumulator** with an integer `tick` counter.

```ts
import { time } from "@f0rbit/forge";

const t = time({ fixed_dt: 1 / 60 });

t.advance(0.016);  // → 0 or 1, # of fixed steps consumed this frame
t.tick;            // → 1 (after a full step)
t.elapsed;         // → tick * fixed_dt (deterministic; no FP drift)
t.alpha;           // → leftover accumulator / fixed_dt, [0, 1) for render interpolation
t.fixed_dt;        // → 0.01666... (the configured step)
t.scale = 0.5;     // slow-mo (writable)
t.scale = 0;       // pause
t.restore(120);    // jump tick to 120 (used by snapshot restore)
```

| Field | Type | Notes |
|---|---|---|
| `fixed_dt` | `number` (readonly) | Default `1/60`. Locked at construction. |
| `tick` | `number` (readonly) | Integer, monotonic. |
| `elapsed` | `number` (readonly) | `tick * fixed_dt`. **Computed**, not accumulated — no FP drift. |
| `alpha` | `number` (readonly) | `[0, 1)` interp factor for render. |
| `scale` | `number` (writable) | Multiplier on `real_dt` before accumulation. |
| `advance(real_dt)` | `(n: number) => number` | Returns # of ticks consumed (0+). |
| `restore(tick)` | `(n: number) => void` | Jump and clear the accumulator. |

**Why?** Pre-v0.1 the engine derived `t.elapsed` by adding `fixed_dt` repeatedly, which drifts after ~10⁶ ticks. The integer-tick model multiplies `tick * fixed_dt` on read — exact for the lifetime of any plausible session and **byte-identical** between recording and replay, which is the foundation of the determinism contract.

### 2.6 RNG

`rng(seed)` returns a deterministic [mulberry32](https://stackoverflow.com/a/47593316) generator. Seed 0 is fine.

```ts
import { rng } from "@f0rbit/forge";

const r = rng(1);
r.next();           // → number in [0, 1), uniform
r.int(0, 9);        // → integer in [0, 9] inclusive
r.pick([1, 2, 3]);  // → Result<T, EngineError>; err({ kind: "empty_array" }) on empty

const enemies = r.fork("enemies");  // independent substream
const loot    = r.fork("loot");     // independent substream
```

**Forking** mixes the parent state with a label hash to derive a child seed. Forks let you advance subsystems independently — if you reorder enemy code one day, the loot RNG stream isn't disturbed. Use forks when you have a clearly-bounded subsystem; one root RNG is fine for small games.

**State + restore** for snapshot:

```ts
const s = r.state();   // → number (current internal state, not the seed)
r.restore(s);          // → identical sequence resumes
r.seed;                // → original seed
```

`Snapshot` round-trips `rng_state` and `rng_seed` (see §5.1).

### 2.7 Resources

Resources are typed singletons keyed by a global symbol. Use them for data that's *world-wide* (score, level info, atlas registry) rather than per-entity.

```ts
import { resource, resources, type ResKey } from "@f0rbit/forge";

type Score = { value: number };
const score_r: ResKey<Score> = resource<Score>("coin.score");

const res = resources();
res.set(score_r, { value: 0 });
res.has(score_r);     // → true
const r = res.get(score_r);
if (r.ok) r.value;    // → { value: 0 }
res.remove(score_r);
```

`resource<T>(name)` uses `Symbol.for("forge.resource:<name>")` — same cross-bundle identity guarantee as components.

| Method | Return |
|---|---|
| `set(k, v)` | `void` |
| `get(k)` | `Result<T, { kind: "resource_missing"; resource: string }>` |
| `has(k)` | `boolean` |
| `remove(k)` | `void` |

**When to use a resource vs a component:**

| Use a resource when... | Use a component when... |
|---|---|
| There's exactly one of it (game phase, score, atlas registry, event queue). | There can be many, indexed by entity. |
| Systems read/write it without iterating entities. | Iteration semantics matter. |
| You'd otherwise spawn a "global" entity to hold it. | Storage is naturally per-entity. |

Built-in resources: `atlas_registry` (compiled atlases for the anim system) and `anim_events` (event buffer for `finished` / `looped` events).

### 2.8 Ctx

Every system receives `(world, ctx)`. The ctx exposes the kernel resources:

```ts
type Ctx = {
  time: Time;
  rng: Rng;
  res: Resources;
  input: Input;
  debug: Debug;
  palette: Palette;
  store?: EngineStore;  // present if boot(...).engine_store was supplied
};
```

The `store` field is optional — `boot()` and the test harness only attach it when explicitly given an `engine_store` instance. Game code that wants persistence can pass one in or query for it:

```ts
sch.add("post", (w, ctx) => {
  if (!ctx.store) return;  // headless test mode
  // ...
});
```

---

## 3. Input

### 3.1 The action-first model

Forge's input layer is **action-first**: raw events (`KeyboardEvent.code`, gamepad axes, mouse buttons) flow into an `Input` instance via an `InputSource`, get *mapped* through `Bindings`, and your game queries the resulting actions (`"jump"`, `"move.x"`).

```
[ DOM / Gamepad / scripted ]
        │  raw events
        ▼
    InputSource ─── drain() ──► Input.advance ─── refresh ──► action state
                                                                │
                                                                ▼
                                                          input.pressed("jump")
                                                          input.axis("move.x")
                                                          input.vector("move.x", "move.y")
```

The flow has three stable boundaries:

1. **Source** — a transport (`browser_source`, `scripted`, `noop_source`). Provides `drain(): readonly RawInput[]`.
2. **Bindings** — a `Record<Action, readonly Trigger[]>` and a parallel `Record<Action, readonly AxisBinding[]>`. Pure data; safe to serialize.
3. **Input** — holds current key/axis/button state, resolves actions on every `advance()`.

**Why the indirection?** Replays record *actions*, not keystrokes. Same recording plays back identically whether the user uses WASD or a gamepad; whether the keyboard layout is QWERTY or Dvorak; whether the future-you renames `KeyA` to something else. Action streams are also far smaller (one event per state transition vs. one per keypress).

### 3.2 Presets

```ts
import { presets } from "@f0rbit/forge/presets";
```

| Preset | Actions | Notes |
|---|---|---|
| `movement2d` | `move.x`, `move.y` (axes) | Arrows + WASD + left stick + d-pad pairs. |
| `movement8way` | `move.left`, `move.right`, `move.up`, `move.down` (digital), plus the `movement2d` axes | Useful when you want both stick smoothing and crisp digital edges. |
| `platformer` | `jump` (digital, Space + pad south), `move.x` (axis) | Side-scrolling. |
| `twinstick` | `move.x`, `move.y` (left stick / WASD), `aim.x`, `aim.y` (right stick / arrows) | Top-down shooter. |
| `menu` | `up`, `down`, `left`, `right`, `confirm`, `cancel` (digital) | Pure d-pad / arrow / Enter / Esc menu controls. |

Presets are plain `Bindings` records — combine them with `merge_bindings`:

```ts
import { merge_bindings } from "@f0rbit/forge";
import { presets } from "@f0rbit/forge/presets";

const bindings = merge_bindings(presets.platformer, presets.menu);
```

### 3.3 Custom bindings

A `Bindings` value has three keys:

```ts
type Bindings = {
  digital: Record<Action, readonly Trigger[]>;
  axes:    Record<Action, readonly AxisBinding[]>;
  deadzone: number;
};
```

Triggers (digital actions):

```ts
type Trigger =
  | { kind: "key";       code: string }                                          // KeyboardEvent.code
  | { kind: "mouse";     button: 0 | 1 | 2 }                                     // 0=left 1=middle 2=right
  | { kind: "pad.button"; button: number; pad?: number }                         // pad omitted = any pad
  | { kind: "pad.axis";   axis: number; pad?: number; threshold?: number; sign?: 1 | -1 };
```

`pad.axis` as a digital trigger fires when `value * sign >= threshold` (default 0.5). Useful for mapping stick directions to digital actions (e.g., "tilt left stick right" → `move.right`).

Axis bindings (continuous values in `[-1, 1]`):

```ts
type AxisBinding =
  | { kind: "key.pair";        positive: string; negative: string }                                  // returns 1, 0, or -1
  | { kind: "pad.axis";         axis: number; pad?: number; scale?: number; deadzone?: number; invert?: boolean }
  | { kind: "pad.button.pair"; positive: number; negative: number; pad?: number };
```

When multiple axis bindings exist for one action, the binding with the **largest absolute value** wins (so a leaning stick doesn't get clobbered by an idle d-pad). The default `deadzone` is `0.15`; per-binding `deadzone` overrides it.

Build a custom binding set:

```ts
import type { Bindings } from "@f0rbit/forge";

const my_bindings: Bindings = {
  digital: {
    jump:  [{ kind: "key", code: "Space" }, { kind: "pad.button", button: 0 }],
    shoot: [{ kind: "mouse", button: 0 }],
  },
  axes: {
    "move.x": [
      { kind: "key.pair", positive: "KeyD", negative: "KeyA" },
      { kind: "pad.axis", axis: 0 },
    ],
  },
  deadzone: 0.15,
};
```

Apply at any time:

```ts
input.bind(my_bindings);                  // replace
input.bind(merge_bindings(input.bindings(), patch));  // patch existing
```

### 3.4 Querying actions

```ts
type ActionState = {
  pressed: boolean;
  just_pressed: boolean;
  just_released: boolean;
  value: number;  // for axes; 1 / 0 for digital
};

input.pressed("jump");           // boolean
input.just("jump");              // boolean — true ONLY on the tick of the down-edge
input.released("jump");          // boolean — true ONLY on the tick of the up-edge
input.axis("move.x");            // number in [-1, 1]
input.vector("move.x", "move.y");// readonly [number, number]
input.query("jump");             // full ActionState
```

`just` and `released` are **single-tick edges** — they fire on exactly one `advance()` and clear on the next. Don't latch them yourself.

Inside a system:

```ts
import type { System } from "@f0rbit/forge";

export const player_input_system: System = (w, ctx) => {
  const [ax, ay] = ctx.input.vector("move.x", "move.y");
  for (const [id] of w.query([player_c, vel_c] as const)) {
    w.set(id, vel_c, { dx: ax * speed, dy: ay * speed });
  }
};
```

### 3.5 Input sources

| Source | Subpath | Use for |
|---|---|---|
| `noop_source()` | `@f0rbit/forge` | Default; no events ever produced. |
| `scripted(events)` | `@f0rbit/forge` | Test fixtures — push raw events all at once. |
| `ticked(frames, get_tick)` | `@f0rbit/forge` | Per-tick scripted events keyed by frame number. |
| `browser_source(opts?)` | `@f0rbit/forge/pixi` | DOM `KeyboardEvent` / `MouseEvent` / `WheelEvent` plus 4 polled gamepads. |

`browser_source` is set automatically by `boot()` against `globalThis.window`. Standalone:

```ts
import { browser_source } from "@f0rbit/forge/pixi";

const src = browser_source({
  target: window,                  // EventTarget; defaults to globalThis.window
  pads: "all",                     // or readonly [0, 1] etc.
  deadzone: 0.15,
  get_time: () => time.tick,       // stamped into every RawInput.t
});
input.source(src);
// ...later...
src.dispose();
```

`RawInput` shape (a discriminated union of 9 variants):

```ts
| { kind: "key.down";        code: string;     pad: null;    t: number }
| { kind: "key.up";          code: string;     pad: null;    t: number }
| { kind: "mouse.down";      button: 0|1|2;    x: number; y: number; pad: null; t: number }
| { kind: "mouse.up";        button: 0|1|2;    x: number; y: number; pad: null; t: number }
| { kind: "mouse.move";      x: number; y: number; pad: null; t: number }
| { kind: "wheel";           dx: number; dy: number; pad: null; t: number }
| { kind: "pad.button.down"; button: number;   pad: PadIndex; t: number }
| { kind: "pad.button.up";   button: number;   pad: PadIndex; t: number }
| { kind: "pad.axis";        axis: number; value: number; pad: PadIndex; t: number };
```

`PadIndex = 0 | 1 | 2 | 3`. Pad button events also write a wildcard `*:button` slot, so `{ kind: "pad.button", button: 0 }` (no `pad`) matches any pad.

Subscribing:

```ts
const off = input.on_raw(events => log_them(events));
const off2 = input.on_pre_advance(() => save_prev_state());
const off3 = input.on_advance(() => write_replay_frame());

off();  // unsubscribe
```

`on_pre_advance` fires *before* state is mutated by the source drain — replay playback hooks here to **inject** action overrides via `inject_actions` before the source's events overwrite anything. `on_advance` fires *after* state is fully refreshed — replay recording reads the action state here and diffs against the previous tick.

### 3.6 Rebinding at runtime

The palette ships `bind` and `unbind` commands:

```
> bind jump Space
bound jump -> Space

> bind shoot mouse:0
bound shoot -> mouse:0

> unbind jump
unbound jump
```

Persisting via `engine_store`:

```ts
import { engine_store } from "@f0rbit/forge/storage";

const store = engine_store();
await store.bindings.save("default", input.bindings());
const loaded = await store.bindings.load("default");
if (loaded.ok) input.bind(loaded.value);
```

`engine_store.bindings` is a `Store<Bindings>` — same interface as `snapshots` (see §5).

---

## 4. Replay

### 4.1 What's recorded

Forge replays are **action streams**, not raw event streams. The recorder watches the action state on every `advance()` (after refresh) and writes one event per *transition*:

| Action kind | Event |
|---|---|
| Digital false→true | `{ kind: "press", action, tick }` |
| Digital true→false | `{ kind: "release", action, tick }` |
| Axis value change | `{ kind: "axis", action, value, tick }` |

Axis changes use a `1e-6` epsilon — minor float jitter doesn't bloat the file.

**Why action streams?** Three reasons:

1. **Size.** A 60-second replay typically has tens-to-hundreds of frames vs. tens of thousands of raw events.
2. **Hardware-independent.** Same recording plays whether the user used WASD or a gamepad.
3. **Forward-compatible.** Add a new mouse axis next year — old replays still work because they record `move.x`, not `MouseMove(45, 91)`.

### 4.2 Recording

Two factories. Most game code uses `record_engine`:

```ts
import { harness, replay } from "@f0rbit/forge";

const h = harness({ seed: 1, fixed_dt: 1/60, bindings: presets.movement2d });
const recorder = replay.record_engine(h.input, h.ctx, { seed: 1 });

// drive the sim however you like — input.inject_actions, scripted source, etc.
h.input.inject_actions([{ kind: "axis", action: "move.x", value: 1 }]);
for (let i = 0; i < 600; i++) {
  h.time.advance(1/60);
  h.schedule.tick(h.world, h.ctx);
}

const doc = recorder.stop();   // detaches listeners, returns ReplayDoc
```

`record_engine(input, ctx, opts?)` infers `seed` and `fixed_dt` from `ctx`. The lower-level `replay.record(input, { seed, fixed_dt, get_tick })` is for cases where you don't have a `Ctx`.

`recorder.dump()` snapshots without stopping (so you can keep recording).

### 4.3 Playback

```ts
const doc: ReplayDoc = /* ... loaded from disk ... */;
const player = replay.play(doc, input, () => time.tick);

while (!player.complete()) {
  time.advance(doc.fixed_dt);
  schedule.tick(world, ctx);
}

player.detach();
```

`play` registers an `on_pre_advance` listener. On every tick, **before** the source drain runs, the player calls `input.inject_actions(events_for_this_tick)`. Injected actions take precedence over the source for that tick, so the world evolves identically to the original recording — provided seed, code, and `fixed_dt` match.

`player.complete()` returns true once the player has drained the last recorded frame. `player.detach()` removes the listener (call this if you switch from playback to live input mid-session).

### 4.4 Format

```ts
type ReplayDoc = {
  version: 1;
  seed: number;
  fixed_dt: number;
  frames: ReadonlyArray<{ tick: number; events: readonly ActionEvent[] }>;
};

type ActionEvent =
  | { kind: "press";   action: string; tick: number }
  | { kind: "release"; action: string; tick: number }
  | { kind: "axis";    action: string; value: number; tick: number };
```

Validated by `replay.schema` (a Zod schema). Frames are **sparse** — only ticks with at least one transition are stored, sorted by `tick`.

Example file (a `coin-collector` win replay):

```json
{
  "version": 1,
  "seed": 1,
  "fixed_dt": 0.016666666666666666,
  "frames": [
    { "tick": 0, "events": [{ "kind": "axis", "action": "move.x", "value": 1, "tick": 0 }] },
    { "tick": 152, "events": [{ "kind": "axis", "action": "move.x", "value": 0, "tick": 152 }] }
  ]
}
```

### 4.5 Save/load

```ts
const json = replay.save(doc);                  // → string
const r = replay.load(json);                    // → Result<ReplayDoc, ReplayError>
if (r.ok) play(r.value);
else if (r.error.kind === "replay_parse_error") /* malformed JSON */;
else if (r.error.kind === "replay_validation_error") /* bad shape */;
```

`replay.save` is `JSON.stringify`. `replay.load` parses, then validates against the Zod schema and returns `Result<ReplayDoc, ReplayError>`.

A `pipe()` chain alternative:

```ts
import { pipe } from "@f0rbit/corpus";

const result = pipe(replay.load(json))
  .map(doc => ({ doc, sim: make_sim(doc) }))
  .build();
```

### 4.6 Replays as test fixtures

The canonical pattern from `coin-collector/test/replay.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { harness, replay } from "@f0rbit/forge";
import type { Ctx, ReplayDoc, World } from "@f0rbit/forge";
import { presets } from "@f0rbit/forge/presets";
import { game_plugin } from "../src/plugin.ts";
import { score_r } from "../src/resources.ts";
import { coin_c, player_c } from "../src/components.ts";

const replay_json = readFileSync(new URL("../replays/win.replay.json", import.meta.url).pathname, "utf8");

const make_sim = (doc: ReplayDoc) => {
  const h = harness({ seed: doc.seed, fixed_dt: doc.fixed_dt, bindings: presets.movement2d });
  game_plugin(h.world, h.schedule);
  replay.play(doc, h.input, () => h.time.tick);
  return {
    ctx: h.ctx,
    w: h.world,
    tick: () => {
      h.time.advance(doc.fixed_dt);
      h.schedule.tick(h.world, h.ctx);
    },
  };
};

const hash_world = (w: World, score: number): string => {
  const players = w.query([player_c] as const).collect().length;
  const coins   = w.query([coin_c]   as const).collect().length;
  return `p=${players}|c=${coins}|s=${score}`;
};

describe("replay deliverable", () => {
  test("replay collects 5 coins", () => {
    const r = replay.load(replay_json);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const sim = make_sim(r.value);
    for (let i = 0; i < 200; i++) sim.tick();
    const s = sim.ctx.res.get(score_r);
    if (s.ok) expect(s.value.value).toBe(50);
  });

  test("two runs of the same replay produce identical state", () => {
    const sim_a = make_sim(replay.load(replay_json).value!);
    const sim_b = make_sim(replay.load(replay_json).value!);
    for (let i = 0; i < 200; i++) { sim_a.tick(); sim_b.tick(); }
    const sa = sim_a.ctx.res.get(score_r);
    const sb = sim_b.ctx.res.get(score_r);
    const va = sa.ok ? sa.value.value : -1;
    const vb = sb.ok ? sb.value.value : -1;
    expect(hash_world(sim_a.w, va)).toBe(hash_world(sim_b.w, vb));
  });
});
```

The **determinism contract** says: same `seed` + same `fixed_dt` + same recorded actions + same code → byte-identical world hash on every run. If you ever see drift, it's a `Date.now`/`Math.random`/async bug somewhere — see §10.

---

## 5. Storage / persistence

### 5.1 Snapshot model

A `Snapshot` is the world state plus minimal kernel state, validated by Zod:

```ts
type Snapshot = {
  version: 1;
  meta: {
    tick: number;
    rng_state: number;
    rng_seed: number;
  };
  entities: ReadonlyArray<{ id: number; components: Record<string, unknown> }>;
  resources: Record<string, unknown>;
};
```

**What's captured:**

- Every entity that has at least one **registered** component, with its registered components serialized by name.
- Every **registered** resource by name.
- `time.tick`, `rng.state()`, and `rng.seed`.

**What's NOT captured (explicit policy):**

- Components you didn't register. (You opt in.)
- Resources you didn't register.
- The schedule. (Code defines stages — restore loads data into a *running* schedule.)
- DOM, PIXI textures, runtime listeners, RAF handles, gamepad state.
- Anything in `closures` (system-internal `let` bindings, etc.).

The kernel state subset (`tick`, `rng_state`, `rng_seed`) is the minimum needed to replay deterministically from a save.

### 5.2 The snapshotter

`snapshotter()` returns a registry. Register components and resources you want serialized:

```ts
import { snapshotter, pos_c, type Snapshotter } from "@f0rbit/forge";
import { z } from "zod";
import { player_c, coin_c, vel_c } from "./components.ts";
import { score_r, type Score } from "./resources.ts";

const pos_schema   = z.object({ x: z.number(), y: z.number() });
const vel_schema   = z.object({ dx: z.number(), dy: z.number() });
const score_schema = z.object({ value: z.number() });

const snap: Snapshotter = snapshotter()
  .register(pos_c,   pos_schema)
  .register(vel_c,   vel_schema)
  .register(player_c, z.literal(true))
  .register(coin_c,   z.literal(true))
  .register_resource(score_r, score_schema);
```

Schemas are optional — pass nothing and `take`/`restore` skip validation. With schemas, `take` and `restore` return `err({ kind: "snapshot_validation_failed", issues })` if any value is rejected.

### 5.3 `take` / `restore` round-trip

```ts
const taken = snap.take(world, { time, rng, res });
if (!taken.ok) console.error(taken.error);

// later, possibly in a different process:
const restored = snap.restore(world, taken.value, { time, rng, res });
if (!restored.ok) console.error(restored.error);
```

`restore` calls `world[internal].clear()` first, then re-spawns each entity at its *original* id via `spawn_at`. After `restore`:

- `time.tick` is set to `snap.meta.tick`.
- `rng` state is restored.
- Every registered resource is set from the snapshot.

`opts.time` and `opts.rng` are optional during restore — pass them when you want kernel state restored, omit when you only want world state.

`save(world, snap, store, slot, opts)` and `load(world, snap, store, slot, opts)` (from `@f0rbit/forge/storage`) compose `snapshotter` with a `Store<Snapshot>` for the common case:

```ts
import { save, load } from "@f0rbit/forge/storage";

await save(world, snap, store, "auto", { time, rng, res });
await load(world, snap, store, "auto", { time, rng, res });
```

Both return `Result<..., SaveError>` where `SaveError = { kind: "snapshot"; cause } | { kind: "store"; cause }`.

### 5.4 `Store<T>` interface

Generic, async, slot-keyed:

```ts
type Store<T> = {
  save:    (slot: Slot, value: T) => Promise<Result<SaveHandle, StoreError>>;
  load:    (slot: Slot) => Promise<Result<T, StoreError>>;
  list:    () => Promise<Result<readonly SaveSlot[], StoreError>>;
  remove:  (slot: Slot) => Promise<Result<void, StoreError>>;
  has:     (slot: Slot) => Promise<boolean>;
  history: (slot: Slot) => AsyncIterable<SaveHandle>;
};
```

A `SaveHandle` is the corpus metadata wrapped to carry the slot:

```ts
type SaveHandle = {
  slot: Slot;
  version: string;     // corpus version id (deterministic content hash)
  content_hash: string;
  created_at: Date;
  parent: SaveHandle | null;
};
```

Multiple saves to the same slot **append a new corpus version** with `parents` pointing at the previous one. `load(slot)` returns the most recent version. `history(slot)` is an async iterator from oldest to newest.

`StoreError` cases:

```ts
type StoreError =
  | { kind: "not_found"; slot: Slot }
  | { kind: "invalid_data"; issues: readonly string[] }
  | { kind: "serialisation_failed"; cause: string }
  | { kind: "backend_error"; operation: string; cause: string };
```

### 5.5 Backends — `mem` and `file`

```ts
import { mem, file } from "@f0rbit/forge/storage";
import { z } from "zod";

const score_schema = z.object({ value: z.number() });

const m = mem({ schema: score_schema });           // in-process, lost on exit
const f = file({ dir: "./saves", schema: score_schema });  // local fs
```

Both return `Store<T>`. The `id` option lets you namespace stores within the same backend (default `"forge.snapshot"`).

`mem` is corpus's memory backend — fully featured: lineage tracking, content-addressed versioning, list/history all work. Use it in tests.

`file` is corpus's file-system backend — files under `<dir>/<store_id>/<version>` plus a metadata sidecar. Use it for desktop builds or local dev.

**IndexedDB is explicitly post-v1.** When the browser-storage backend lands in `@f0rbit/corpus`, the same `Store<T>` interface works — no engine changes needed.

### 5.6 `EngineStore` composite

Most games want one corpus instance shared across snapshots, bindings, and prefs:

```ts
import { engine_store } from "@f0rbit/forge/storage";

const store = engine_store({ backend: "file", dir: "./saves" });
//   ^ EngineStore = {
//       snapshots: Store<Snapshot>;
//       bindings:  Store<Bindings>;
//       prefs:     Store<Prefs>;
//       corpus():  Corpus;
//     }

await store.snapshots.save("auto", taken.value);
await store.bindings.save("default", input.bindings());
await store.prefs.save("user", { debug_enabled: true, time_scale: 1, autosave: false });
```

| Sub-store | Type | Default schema |
|---|---|---|
| `snapshots` | `Store<Snapshot>` | `snapshot_schema` |
| `bindings` | `Store<Bindings>` | `bindings_schema` (validates trigger union, axis union, deadzone) |
| `prefs` | `Store<Prefs>` | `prefs_schema` (`debug_enabled`, `time_scale`, `autosave`) |

Pass into `boot()` so palette `save` / `load` commands work:

```ts
const r = await boot({
  mount: "#root",
  engine_store: store,
  // ...
});
```

Default options:

```ts
engine_store();                         // mem backend, prefix "forge"
engine_store({ backend: "mem" });       // explicit
engine_store({ backend: "file", dir: "./saves", id_prefix: "mygame" });
```

### 5.7 Future backends

| Backend | Status | Plan |
|---|---|---|
| `mem` | Shipped (v0.1.0) | — |
| `file` | Shipped (v0.1.0) | — |
| IndexedDB | Post-v1 | When `@f0rbit/corpus` ships an idb backend, slot it in via `engine_store({ backend: "idb" })`. No API change. |
| Cloudflare R2 / D1 | Post-v1 | Cloud saves for web embeds. Layered with the file/idb backend for offline-first. |

---

## 6. Debug

### 6.1 Frame-buffer shapes

Every `debug.line` / `circle` / `rect` / `text` call **enqueues** a draw command. The buffer drains automatically at the end of the `render` stage (`schedule.tick` calls `ctx.debug.frame()` after `render`). One-frame draw calls — call them every tick if you want them every frame.

```ts
import { vec2 } from "@f0rbit/forge";

debug.line(vec2(0, 0), vec2(100, 50), "red");
debug.circle(vec2(80, 40), 12, "yellow");
debug.rect(50, 20, 32, 32, "green");
debug.text(vec2(64, 8), `score: ${score}`, "white");
```

`Color` is a string — named (`"red"`, `"green"`, ...) or hex (`"#ff8844"`). The pixi renderer's `COLOR_HEX` map covers white, black, red, green, blue, yellow, cyan, magenta, grey/gray; anything else expects `#rrggbb`.

`debug.frame()` returns and clears the buffer:

```ts
type DebugCmd =
  | { kind: "line";   a: Vec2; b: Vec2; color: Color }
  | { kind: "circle"; center: Vec2; r: number; color: Color }
  | { kind: "rect";   x: number; y: number; w: number; h: number; color: Color }
  | { kind: "text";   pos: Vec2; text: string; color: Color };
```

Headless tests can read frames directly:

```ts
debug.line(vec2(0, 0), vec2(10, 10));
const cmds = debug.frame();
expect(cmds).toHaveLength(1);
expect(cmds[0].kind).toBe("line");
```

### 6.2 Per-entity pins

Pins survive frames (until their TTL elapses), so they're for **persistent overlay annotations**, not one-off shapes:

```ts
debug.pin(entity, { kind: "label", data: "boss", ttl: 120 });   // 120 ticks
debug.pin(entity, { kind: "box",   data: { w: 16, h: 16 } });   // default ttl 60
debug.pin(entity, { kind: "arrow", data: { tx: 50, ty: 50 } });

debug.pinned(entity);   // → readonly Pin[] for that entity
debug.pinned();          // → readonly Pin[] across all entities
debug.unpin(entity, "label");  // remove one kind
debug.unpin(entity);            // remove all kinds for the entity
```

`PinKind = "label" | "box" | "arrow"` — three slots per entity. A second pin of the same kind overwrites the first.

TTL: the debug system bumps `cur_tick` on `tick_stats(world, time)` and expires pins where `cur_tick - added_tick >= ttl`. `ttl: 0` means "live forever". The PIXI debug renderer renders pins as text every frame.

### 6.3 Inspector

```ts
type Inspection = {
  entity: Id;
  components: readonly { name: string; data: unknown }[];
};

const i = debug.inspect(world, entity);
// → { entity: 5, components: [{ name: "pos", data: { x: 80, y: 40 } }, { name: "vel", data: ... }] }
```

The palette `inspect` command formats this into a printable string.

`debug.select(id)` and `debug.selected()` track a selected entity for tools — useful when wiring a click-to-select feature in dev mode.

### 6.4 HUD stats

```ts
type DebugStats = {
  tick: number;
  entities: number;
  fps: number;
  tscale: number;          // time.scale (writable on time, mirrored here)
  system_us: Record<string, number>;
};

debug.stats();              // → DebugStats (live reference)
debug.tick_stats(world, time, fps?);   // bumps tick + entities, optionally sets fps
debug.timing("collisions", 87);        // record a system's microsecond cost
debug.counter("pickups", 3);           // arbitrary named counter
debug.counters();                       // → Record<string, number | string>
```

The PIXI render system computes a smoothed real-time fps via `performance.now()` (allowed inside `src/pixi/`) and writes it into `debug.stats().fps` every frame. **`__DEV__`-gated** — production builds skip the calc.

The HUD label is `tscale` (time-scale — writable, slow-mo) to disambiguate from viewport scale (`camera.viewport().scale` — pixel scale).

### 6.5 `__DEV__` gating

Three layers of stripping:

1. **Runtime** — `is_dev()` reads `globalThis.__DEV__` if set, else falls back to `process.env.NODE_ENV !== "production"`. Set `globalThis.__DEV__ = false` early in your bootstrap to globally disable debug output.
2. **`debug({ dev: false })`** — short-circuit individual debug instances.
3. **`debug_noop()`** — a zero-overhead stub. Pass into the harness/boot when you want compile-time tree-shaking of debug calls (production builds).

Bundler-define pattern (rolldown/rolldown-vite):

```ts
// rolldown.config.ts
export default {
  // ...
  define: {
    __DEV__: process.env.NODE_ENV === "production" ? "false" : "true",
  },
};
```

When `__DEV__` resolves to a literal `false`, dead-branch elimination drops the debug emit calls entirely.

---

## 7. Palette

### 7.1 Toggling

The PIXI palette overlay listens for **backtick** (\`) on `globalThis.window` and toggles on/off. While open it captures keypresses (printable chars, `Enter`, `Backspace`, `Escape`, `ArrowUp`/`Down`).

The palette engine itself is pure logic:

```ts
import { palette } from "@f0rbit/forge";

const p = palette({ history_size: 100 });
p.toggle();         // open/close
p.open();           // → boolean
```

In headless tests you drive it directly via `palette.exec("save run-1", ctx)` — no UI required.

### 7.2 Built-in commands

Wire built-ins into the palette via `palette.register(...)`:

```ts
import { palette, builtins, snapshotter } from "@f0rbit/forge";
import { engine_store } from "@f0rbit/forge/storage";

const p = palette();
const snap = snapshotter().register(pos_c).register(vel_c);
const store = engine_store();

for (const cmd of builtins({ world, snapshotter: snap, snapshots: store.snapshots })) {
  p.register(cmd);
}
```

| Name | Args | Effect | Output / Error |
|---|---|---|---|
| `save` | `<slot:string>` | `snapshotter.take` + `store.save` | `"saved to slot:<slot>"` / `"snapshot failed:..."` |
| `load` | `<slot:string>` | `store.load` + `snapshotter.restore` | `"loaded from slot:<slot>"` / `"slot not found:..."` |
| `pause` | — | Stashes prior `time.scale`, sets to 0 | `"paused"` |
| `resume` | — | Restores prior scale (or 1) | `"resumed at scale <n>"` |
| `tscale` | `<scale:number>` | Sets `time.scale` directly | `"time.scale=<n>"` |
| `bind` | `<action:string> <trigger:string>` | Appends a digital trigger | `"bound jump -> Space"` |
| `unbind` | `<action:string>` | Removes all triggers + axes for action | `"unbound jump"` |
| `inspect` | `<id:int>` | Calls `debug.inspect` | `"#5\n  pos = {...}\n  vel = {...}"` |
| `dbg` | `[on \| off \| toggle]` | Toggles debug overlay | `"debug=true"` / `"debug=false"` |

`bind` accepts:

- `Space`, `KeyA`–`KeyZ`, `Digit0`–`Digit9`, `Arrow{Up,Down,Left,Right}`, `F1`–`F12`, `Enter`, `Escape`, `Backspace`, `Tab`, `Shift{Left,Right}` — bare `KeyboardEvent.code` strings.
- `key:<code>` — explicit key namespace.
- `mouse:0` / `mouse:1` / `mouse:2` — mouse buttons.
- `pad.button:<n>` — gamepad button.

All commands return `Result<string, CommandError>`; the palette UI shows the success string in green, the error string in red, for ~120 ticks.

### 7.3 Registering custom commands

```ts
import { palette, type Command } from "@f0rbit/forge";
import { z } from "zod";

const give_coins: Command<readonly [number]> = {
  name: "give_coins",
  desc: "add N coins to the score",
  args: z.tuple([z.number().int().nonnegative()]),
  run: ([n], ctx) => {
    const s = ctx.res.get(score_r);
    if (!s.ok) return { ok: false, error: { kind: "runtime", message: "no score" } };
    s.value.value += n;
    return { ok: true, value: `+${n} coins` };
  },
};

p.register(give_coins);
```

`run` may be sync or async; the palette `await`s it either way. Args go through `coerce_arg` first (numeric strings become numbers, `true`/`false` become booleans), then through the Zod schema.

`CommandError` cases:

```ts
type CommandError =
  | { kind: "unknown_command"; name: string }
  | { kind: "parse";           message: string }
  | { kind: "validation";      issues: readonly string[] }
  | { kind: "runtime";         message: string };
```

### 7.4 Search and history

```ts
p.search("sa");              // → [{ command: save_cmd, score: 0.83 }, ...]
p.history();                 // → readonly string[]
p.clear_history();
p.recall(1);                 // most recent line
p.recall(2);                 // second most recent
```

`fuzzy_score` ranks by character-level prefix match with bonuses for consecutive runs. Ties break alphabetically. The PIXI palette shows up to 6 hits below the prompt.

---

## 8. PIXI integration

### 8.1 `boot(opts)`

`boot` is the big-bang entry: build the world (or use yours), wire pixi, register sprite/anim/render systems, return an `App`.

```ts
import { boot, type BootOpts, type App } from "@f0rbit/forge/pixi";

const r = await boot({
  mount: "#root",
  window: { width: globalThis.innerWidth, height: globalThis.innerHeight },
  camera: {
    design: { width: 320, height: 180 },
    mode: "extend",
    min: { width: 320, height: 180 },
  },
  bindings: presets.movement2d,
});
if (!r.ok) throw new Error(`boot failed: ${r.error.kind}`);
const app: App = r.value;
```

`BootOpts` (v0.1.4):

```ts
type BootOpts = {
  mount: HTMLElement | string;        // CSS selector or element
  world?:    World;
  schedule?: Schedule;
  time?:     Time;
  rng?:      Rng;
  res?:      Resources;
  input?:    Input;
  debug?:    Debug;
  palette?:  Palette;
  bindings?: Bindings;
  engine_store?: EngineStore;
  camera?:   CameraOpts;              // see §8.2
  window?:   { width: number; height: number };  // host window — required for non-trivial cases
  assets?:   readonly AssetSpec[];    // [{ kind: "image", alias, url } | { kind: "atlas", alias, url }]
  pos?:      Component<{ x: number; y: number }>; // override pos_c
  __dev__?:  boolean;
};
```

**v0.1.4 breaking change:** the old `width` / `height` / `background` fields are gone. Use `window` for the host window size and `camera.design` for the authored design size. Background is now controlled by CSS (`#root { background: #000; }`) or by the surface texture's clear color (transparent by default).

`App` shape:

```ts
type App = {
  app:      Application;       // raw PIXI Application (escape hatch)
  world:    World;
  schedule: Schedule;
  time:     Time;
  rng:      Rng;
  res:      Resources;
  input:    Input;
  debug:    Debug;
  palette:  Palette;
  assets:   Assets;
  render:   RenderState;       // .resize(w,h), .canvas(), .stats, .viewport()
  camera:   Camera;
  source:   BrowserSource;
  tick:     (real_dt: number) => void;
  start:    () => void;        // begins the requestAnimationFrame loop
  stop:     () => void;        // cancels the loop (idempotent)
  dispose:  () => void;        // stop + dispose source/render/palette
  canvas:   () => HTMLCanvasElement | null;
  ctx:      () => Ctx;
};
```

`BootError` cases:

```ts
type BootError =
  | { kind: "mount_not_found"; selector: string }
  | { kind: "render_failed";   cause: RenderError }
  | { kind: "asset_failed";    alias: string; cause: AssetError };
```

### 8.2 Camera modes

The camera takes a **design viewport** (the size you authored your game for) and a **window** (the host browser window). It returns a `Viewport`:

```ts
type Viewport = {
  scale: number;                          // pixel scale (integer except in "fit")
  view:  { width: number; height: number }; // game-space viewport size
  offset: { x: number; y: number };       // black-bar offset on the host
};
```

**Five modes**, each with worked sizing math for design 320×180 and host window 1920×1080.

**`letterbox`** — pixel-perfect, design viewport never changes, black bars fill the rest.

```
sx = 1920 / 320 = 6
sy = 1080 / 180 = 6
raw = min(6, 6) = 6
pixel_perfect → floor(6) = 6
view  = { 320, 180 }
offset = { (1920 - 320*6)/2, (1080 - 180*6)/2 } = { 0, 0 }
```

`design 320×180` on `1280×720`:

```
sx = 1280/320 = 4, sy = 720/180 = 4 → scale 4
view  = { 320, 180 }
offset = { (1280-1280)/2, (720-720)/2 } = { 0, 0 }
```

`design 320×180` on `1366×768`:

```
sx = 4.27, sy = 4.27 → floor(4.27) = 4
view  = { 320, 180 }
offset = { (1366 - 320*4)/2, (768 - 180*4)/2 } = { 43, 24 }    // 43px left/right bars, 24px top/bottom
```

**`extend`** — pixel-perfect, view extends both axes to fill more of the host. Use when you want larger windows to "see more world".

`design 320×180` on `1920×1080`, no `min`/`max`:

```
scale = floor(min(6, 6)) = 6
view_w = round(1920/6) = 320
view_h = round(1080/6) = 180
offset = { 0, 0 }
```

`design 320×180`, `min: { 320, 180 }`, `max: { 480, 270 }`, on `1920×1200` (taller window):

```
sx = 1920/320 = 6, sy = 1200/180 = 6.67 → floor(min) = 6
view_w_raw = round(1920/6) = 320
view_h_raw = round(1200/6) = 200 → clamped to max(270) → 200 (within max)
view  = { 320, 200 }
offset = { (1920 - 320*6)/2, (1200 - 200*6)/2 } = { 0, 0 }
```

`design 320×180`, `min`, `max`, on `2560×1440`:

```
scale = floor(min(8, 8)) = 8
view_w_raw = 320, view_h_raw = 180
view  = { 320, 180 }   // window happens to be exact integer multiple
offset = { 0, 0 }
```

**`extend-x`** — extend horizontally only. Vertical view = design height.

`design 320×180` on `1920×1080`:

```
scale = 6
view_w_raw = round(1920/6) = 320, view_h = 180
offset_x = 0, offset_y = 0
```

`design 320×180` on `2560×1080`:

```
sx = 8, sy = 6 → scale = floor(min) = 6
view_w_raw = round(2560/6) = 427
view_h     = 180
offset_x = (2560 - 427*6)/2 = -1, offset_y = (1080 - 180*6)/2 = 0
```

(The `-1` happens because `round` introduces a 1px slop; the surface still centers, just offset by a fractional amount the renderer floors.)

**`extend-y`** — extend vertically only. Horizontal view = design width.

**`fit`** — fractional scale, design viewport never changes, **smooth scaling** (likely with `smoothing: true`).

`design 320×180` on `1920×1080`:

```
scale = min(1920/320, 1080/180) = min(6, 6) = 6.0
view  = { 320, 180 }
offset = { 0, 0 }
```

`design 320×180` on `1366×768`:

```
scale = min(1366/320, 768/180) = min(4.27, 4.27) = 4.27
view  = { 320, 180 }
offset = { (1366 - 320*4.27)/2, (768 - 180*4.27)/2 } = { 0.8, 0.7 }
```

Use `fit` when you want to fill the window and don't care about pixel art crispness. Combine with `smoothing: true`.

### 8.3 `pixel_perfect` and `smoothing`

```ts
camera: {
  design: { width: 320, height: 180 },
  mode: "letterbox",
  pixel_perfect: true,   // default true; floor scale to integer
  smoothing: false,      // default false; use "nearest" texture filtering
}
```

Pixel-art games: leave defaults. High-resolution assets: `pixel_perfect: false, smoothing: true`. The renderer flips PIXI's default `TextureSource.scaleMode` and the surface render-texture's `scaleMode` based on `smoothing`.

If `pixel_perfect: true` but the window is *smaller* than the design viewport, the camera falls back to fractional scale and emits a `console.warn` in dev:

```
forge.camera: window 240x140 smaller than design 320x180; falling back to fractional scale 0.750 (pixel_perfect ignored)
```

### 8.4 Resize

`boot` does not subscribe to window resize. Wire it explicitly:

```ts
globalThis.addEventListener("resize", () => {
  app.render.resize(globalThis.innerWidth, globalThis.innerHeight);
});
```

`render.resize(w, h)` calls `camera.resize(w, h)` (which recomputes the viewport), `app.renderer.resize(w, h)`, and reapplies the new viewport to the surface sprite (scale + offset) and the render texture (size).

For an Astro embed or a sized container, `ResizeObserver` against the mount works the same way:

```ts
new ResizeObserver(([entry]) => {
  const { width, height } = entry!.contentRect;
  app.render.resize(width, height);
}).observe(mount);
```

### 8.5 Two-stage render flow

PixelatedPope-style ([source](https://www.html5gamedevs.com/topic/45827-pixelpope-pixel-art-with-pixijs/)):

```
1. World container ─renderer.render→ RenderTexture (sized to viewport.view)
2. Surface Sprite (textured by RenderTexture) ─addChild→ stage
   - scale = viewport.scale
   - position = viewport.offset
3. Stage rendered to canvas (default render path)
```

This keeps the world container at **design coordinates** — no per-frame container scaling. Subpixel artifacts go away because the only resampling is texture→canvas, controlled by `scaleMode`.

Debug overlay and palette overlay are added **directly to the stage** (not the world). They render in *screen space* — when the camera scales the surface, debug labels stay readable. If you want a debug shape in *world space*, draw it inside a system that projects via `camera.world_to_screen`.

```ts
type RenderState = {
  app: Application;            // PIXI app
  world: Container;            // world container (game-space)
  debug_overlay: Container;    // stage child (screen-space)
  palette_overlay: Container;  // stage child (screen-space)
  camera: Camera;
  canvas: () => HTMLCanvasElement | null;
  dispose: () => void;
  stats: { last_render_us: number; fps: number };
  render_system: () => System;
  resize: (w: number, h: number) => void;
  viewport: () => Viewport;
};
```

You shouldn't need `make_render` directly — `boot()` calls it internally — but it's exported as an escape hatch for custom embed scenarios.

### 8.6 Asset loading

```ts
import { boot } from "@f0rbit/forge/pixi";

const r = await boot({
  mount: "#root",
  assets: [
    { kind: "image", alias: "hero",   url: "/sprites/hero.png" },
    { kind: "atlas", alias: "tilemap", url: "/atlases/tilemap.json" },
  ],
  // ...
});
```

`assets` returns `Result<App, BootError>` — if any asset fails, `boot` disposes the renderer and returns `err({ kind: "asset_failed", alias, cause: AssetError })`.

Standalone:

```ts
const a = app.assets;

const tex_r = await a.image("hero", "/sprites/hero.png");
if (!tex_r.ok) console.error(tex_r.error);

const sheet_r = await a.atlas("hero_atlas", "/sprites/hero.json");
if (sheet_r.ok) sheet_r.value.textures["walk_0"];

a.has("hero");                                    // → true
a.texture("hero");                                 // → Result<Texture, AssetError>
a.get<Spritesheet>("hero_atlas");                  // → Result<T, AssetError>
a.dispose();                                       // clear cache
```

`AssetError` cases:

```ts
type AssetError =
  | { kind: "load_failed";   alias: string; url: string; cause: string }
  | { kind: "not_loaded";    alias: string }
  | { kind: "invalid_atlas"; alias: string; issues: readonly string[] }
  | { kind: "wrong_kind";    alias: string; expected: string };
```

Atlas JSON is the standard TexturePacker JSON-Hash format with optional `animations` arrays. Frame `duration` (ms) is converted to whole-tick durations using the configured `fixed_dt` — see §8.8.

#### The `__default__` atlas

For "I just want to see something on screen", forge auto-registers a 4-frame placeholder atlas at boot:

| Alias | Frames | Pixels |
|---|---|---|
| `__default__` | `__default_0__`, `__default_1__`, `__default_2__`, `__default_3__` | 16×16 each, magenta / cyan / yellow / black |

It also defines a `spin` sequence (all four frames at 100ms each) so `anim_c.play("__default__", "spin")` works out of the box.

```ts
w.set(player, sprite_c, {
  texture: "__default__",
  frame: "__default_0__",
  anchor: { x: 0.5, y: 0.5 },
});
```

This is the pattern used in `coin-collector/src/main.ts`.

To skip the default atlas (e.g., production builds with no missing-art fallback):

```ts
const a = assets({ register_default: false });
```

(Pass your own `assets` instance via the `boot` API isn't currently supported — `register_default: true` is hard-coded inside `boot`. Bring-your-own atlases simply override entries with the same alias if you ever load `"__default__"` yourself.)

### 8.7 Sprite component

```ts
import { sprite_c, type SpriteData } from "@f0rbit/forge/pixi";

type SpriteData = {
  texture: string;                    // alias of an image OR atlas
  frame?: string;                     // frame name within an atlas
  anchor?: { x: number; y: number };  // 0–1, sprite-relative pivot
  tint?: number;                      // 0xRRGGBB
  visible?: boolean;
  z?: number;                         // zIndex within world container
  node?: Sprite | null;               // populated lazily by sprite_sync_system
};

w.spawn(
  [pos_c, { x: 80, y: 40 }],
  [sprite_c, { texture: "hero", anchor: { x: 0.5, y: 1 } }],
);
```

The `sprite_sync_system` (added by `boot` to the `post` stage) watches `(pos_c, sprite_c)` pairs each tick:

- First time it sees an entity: creates a PIXI `Sprite`, adds to the world container, writes back `sd.node`.
- Resolves the texture: `assets.texture(alias)` first, then atlas `frame` lookup, then *first frame of the atlas* as a last resort. If still nothing, sprite stays without a texture (often visible as a tiny white square or invisible).
- Updates: position from `pos_c`, anchor / tint / visibility / zIndex from `sprite_c`.
- Despawn cleanup: any sprite whose entity vanished from the query gets `removeFromParent()` + `destroy()`.

The lazy-mount means you can `w.set(id, sprite_c, {...})` without ever touching PIXI — the system handles the pixi-side construction.

### 8.8 Anim component

```ts
import { anim_c, anim, atlas_registry, type AnimData } from "@f0rbit/forge";

type AnimData = {
  atlas: string;       // atlas alias
  sequence: string;    // animation name within atlas
  frame: number;       // current frame index
  t: number;           // accumulated tick fraction within frame
  speed: number;       // ticks-per-update multiplier (1 = normal)
  loop: boolean;
  done: boolean;
};

const a = anim();
sch.add("update", a.advance, "anim.advance");

// give an entity an animation
w.spawn(
  [pos_c, { x: 0, y: 0 }],
  [sprite_c, { texture: "__default__", anchor: { x: 0.5, y: 0.5 } }],
  [anim_c, { atlas: "__default__", sequence: "spin", frame: 0, t: 0, speed: 1, loop: true, done: false }],
);

// trigger a different sequence
a.play(world, entity, "walk", { speed: 2, loop: true });
a.stop(world, entity);
a.playing(world, entity);  // → boolean
```

**Whole-tick frame durations.** Atlas JSON `duration` (in ms) is converted at load time to integer ticks via `Math.round((ms / 1000) / fixed_dt)`. So a 100ms frame at `fixed_dt: 1/60` becomes 6 ticks. Determinism depends on this — if you ever change `fixed_dt`, recompile your atlas durations.

**Atlas registry.** The `atlas_registry` resource holds `Record<string, Record<string, readonly { frame: string; ticks: number }[]>>`. `boot` populates it with every atlas you load via `assets`. The `anim.advance` system reads from it to look up sequences.

**Events.** When a non-loop animation finishes, or a loop animation wraps around, `anim.advance` pushes an event into the `anim_events` resource buffer (if registered):

```ts
import { anim_events, resources } from "@f0rbit/forge";

const res = resources();
res.set(anim_events, { events: [] });

// ...later, after schedule.tick:
const buf = res.get(anim_events);
if (buf.ok) {
  for (const ev of buf.value.events) {
    if (ev.kind === "finished") /* ... */;
    if (ev.kind === "looped")   /* ... */;
  }
}
```

The buffer is **drained at the start of each `anim.advance` call** — read it within the same tick or it's gone. If you don't register `anim_events`, no events are pushed.

**The PIXI side.** `anim_sync_system` (added to `post` by `boot`) reads the current frame from `anim_c`, looks up the corresponding texture in the atlas, and assigns it to the sprite's `Sprite.texture`. It **never** uses PIXI's `AnimatedSprite` — that class ticks on `Ticker`, which is wall-clock and would silently break determinism.

If the atlas alias is missing it falls back to `__default__` and increments `debug.counter("anim.missing_atlas", ...)`. Same fallback path for missing sequences.

---

## 9. Test harness

```ts
import { harness, type Harness, type HarnessOpts } from "@f0rbit/forge";

const h: Harness = harness({
  seed: 1,
  fixed_dt: 1/60,
  bindings: presets.movement2d,
  __dev__: true,
});
```

Returns:

```ts
type Harness = {
  world: World;
  schedule: Schedule;
  time: Time;
  rng: Rng;
  res: Resources;
  input: Input;
  debug: Debug;
  palette: Palette;
  ctx: Ctx;
  tick: (real_dt?: number) => void;
};
```

`harness.tick(real_dt?)` advances `time`, runs the `update` stage, and drains the debug frame. Use `h.schedule.tick(h.world, h.ctx)` to pump every stage (including `pre` / `post` / `render`) — `harness.tick` is the minimal "just run game logic" path.

**Use cases:**

- **Unit-test a single system.** Spawn entities, call the system directly: `my_system(h.world, h.ctx)`.
- **Integration-test a plugin.** Install via `game_plugin(h.world, h.schedule)`, drive with `h.input.inject_actions(...)`, advance ticks.
- **Replay-driven test.** Wire `replay.play(doc, h.input, () => h.time.tick)` and tick to completion. (See §4.6.)

`__dev__` controls whether `debug` is the real `debug({ enabled: true, dev: true })` instance or `debug_noop()`. Default `true`. Pass `false` for production-mode testing.

The harness omits `engine_store` from its `ctx` — wire one up yourself if your tests need persistence:

```ts
const h = harness();
const store = engine_store();
const ctx = { ...h.ctx, store };
sys(h.world, ctx);
```

---

## 10. Determinism contract

**Same `seed` + same `fixed_dt` + same recorded action stream + same code = byte-identical world hash on every run.**

This is the engine's hard guarantee and the foundation of replay-as-fixture testing.

### What's guaranteed

- Integer `time.tick` (no FP drift in the timeline).
- Insertion-ordered systems within each stage.
- Sorted entity iteration in snapshot output.
- Seeded `mulberry32` RNG.
- Action streams instead of raw events.
- Whole-tick animation frame durations.

### What would break it (foot-guns)

| Source | Mitigation |
|---|---|
| `Date.now()` | Banned outside `src/pixi/`. Use `time.tick`. |
| `Math.random()` | Banned engine-wide. Use `rng.next()` / `rng.fork()`. |
| `setTimeout` / `setInterval` | Banned outside `src/pixi/`. Use a tick counter or schedule a periodic system. |
| `Map` insertion order surprises | Engine relies on insertion order — don't reorder maps mid-iteration. |
| Async game logic | Don't `await` inside a system. The schedule is synchronous. |
| Floating-point drift on `t.elapsed` | Pre-v0.1 issue; v0.1.x integer-tick model fixes it. |
| `Date.now()`-seeded `rng()` | Seed deterministically in your boot code. |

### Enforcement

The repo runs `bun tools/no-throws.ts` (the `check:determinism` script) which AST-walks `src/` and fails the build on:

- `Date.now`, `Math.random`, `setTimeout`, `setInterval` outside `src/pixi/`.
- `pixi.js` / `@pixi/*` imports outside `src/pixi/`.

### The PIXI quarantine

`src/pixi/` is the *only* directory allowed browser non-determinism. It uses:

- `performance.now()` for HUD fps (gated on `is_dev()`; production skips entirely).
- Gamepad polling (snapshots taken inside `drain()`; events are then deterministic per tick).
- Browser DOM events (`KeyboardEvent`, `MouseEvent`) — non-deterministic by nature, but they only matter for *live* play. Replays inject deterministic actions at `pre_advance`, bypassing the source.

### Why this matters even for single-player games

- **Replay tests.** Cheap regression coverage — record a winning run once, replay it on every CI.
- **Save/load.** A snapshot taken at tick 600 must produce the same future as the original session.
- **Bug repros.** "Run this 12-second replay against the latest code" is a much better repro than "WASD a bunch and see if the player gets stuck".
- **Future multiplayer.** When the action-stream model gets wrapped in netcode, lockstep just works.

---

## 11. Cookbook

### 11.1 Movement: input → vel → pos

```ts
import type { System } from "@f0rbit/forge";
import { pos_c } from "@f0rbit/forge";
import { player_c, vel_c } from "./components.ts";

const speed = 80;

export const player_input_system: System = (w, ctx) => {
  const [ax, ay] = ctx.input.vector("move.x", "move.y");
  for (const [id] of w.query([player_c, vel_c] as const)) {
    w.set(id, vel_c, { dx: ax * speed, dy: ay * speed });
  }
};

export const movement_system: System = (w, ctx) => {
  const dt = ctx.time.fixed_dt;
  for (const [, p, v] of w.query([pos_c, vel_c] as const)) {
    p.x += v.dx * dt;
    p.y += v.dy * dt;
  }
};
```

### 11.2 Collision (radius)

```ts
const radius_sq = 8 * 8;

export const collection_system: System = (w, ctx) => {
  const players = w.query([pos_c, player_c] as const).collect();
  if (players.length === 0) return;
  const score = ctx.res.get(score_r);
  if (!score.ok) return;

  for (const [, pp] of players) {
    for (const [cid, cp] of w.query([pos_c, coin_c] as const).collect()) {
      const dx = pp.x - cp.x;
      const dy = pp.y - cp.y;
      if (dx * dx + dy * dy <= radius_sq) {
        w.despawn(cid);
        score.value.value += 10;
      }
    }
  }
};
```

### 11.3 Collision (AABB)

```ts
const aabb_overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const box_c = component<{ w: number; h: number }>("box");

export const aabb_system: System = w => {
  const players = w.query([pos_c, box_c, player_c] as const).collect();
  for (const [, pp, pb] of players) {
    const pbox = { x: pp.x, y: pp.y, w: pb.w, h: pb.h };
    for (const [eid, ep, eb] of w.query([pos_c, box_c, enemy_c] as const).collect()) {
      const ebox = { x: ep.x, y: ep.y, w: eb.w, h: eb.h };
      if (aabb_overlap(pbox, ebox)) w.despawn(eid);
    }
  }
};
```

### 11.4 Level setup (startup system)

```ts
import type { System } from "@f0rbit/forge";

export const setup: System = (w, ctx) => {
  if (!ctx.res.has(score_r)) ctx.res.set(score_r, { value: 0 });

  w.spawn(
    [pos_c, { x: 40, y: 90 }],
    [vel_c, { dx: 0, dy: 0 }],
    [player_c, true],
  );
  for (const x of [120, 160, 200, 240, 280]) {
    w.spawn([pos_c, { x, y: 90 }], [coin_c, true]);
  }
};

sch.add("startup", setup, "level.setup");
```

### 11.5 Win/lose state (phase resource)

```ts
import { resource, type ResKey } from "@f0rbit/forge";

type Phase = { state: "playing" | "won" | "lost" };
const phase_r: ResKey<Phase> = resource<Phase>("phase");

const startup: System = (_, ctx) => ctx.res.set(phase_r, { state: "playing" });

const win_check: System = (w, ctx) => {
  const phase = ctx.res.get(phase_r);
  if (!phase.ok || phase.value.state !== "playing") return;
  const remaining = w.query([coin_c] as const).collect().length;
  if (remaining === 0) phase.value.state = "won";
};
```

### 11.6 Spawn-on-event (event queue resource)

```ts
type SpawnEvent = { kind: "enemy"; x: number; y: number };
const spawn_q_r: ResKey<{ events: SpawnEvent[] }> = resource("spawn_queue");

const startup: System = (_, ctx) => ctx.res.set(spawn_q_r, { events: [] });

// producer
const trigger: System = (w, ctx) => {
  const q = ctx.res.get(spawn_q_r);
  if (q.ok && ctx.time.tick % 120 === 0) {
    q.value.events.push({ kind: "enemy", x: ctx.rng.int(0, 320), y: 0 });
  }
};

// consumer (drain at start of update)
const consume: System = (w, ctx) => {
  const q = ctx.res.get(spawn_q_r);
  if (!q.ok) return;
  for (const ev of q.value.events) {
    if (ev.kind === "enemy") w.spawn([pos_c, { x: ev.x, y: ev.y }], [enemy_c, true]);
  }
  q.value.events.length = 0;
};

sch.add("pre",    consume, "spawn.consume");
sch.add("update", trigger, "spawn.trigger");
```

### 11.7 Score persistence

```ts
import { engine_store } from "@f0rbit/forge/storage";
import { z } from "zod";

const highscore_schema = z.object({ value: z.number() });
const store = engine_store({ backend: "file", dir: "./saves" });

// ad-hoc Store<T> via `store({...})` — but for the engine_store stack you'd
// register the schema differently. For ad-hoc top-level keys use `mem` or `file`:
import { file } from "@f0rbit/forge/storage";
const highscore_store = file({ dir: "./saves", schema: highscore_schema });

await highscore_store.save("default", { value: 1200 });
const loaded = await highscore_store.load("default");
if (loaded.ok) console.log("hi", loaded.value.value);
```

### 11.8 Animation cycling

```ts
import { anim, anim_c } from "@f0rbit/forge";

const a = anim();
sch.add("update", a.advance, "anim.advance");

w.set(player, anim_c, {
  atlas: "hero",
  sequence: "idle",
  frame: 0, t: 0, speed: 1, loop: true, done: false,
});

// later:
const r = a.play(w, player, "walk");
if (!r.ok) console.warn("anim play failed", r.error);
```

### 11.9 Periodic systems

There is **no** `schedule.add_periodic(N, sys)` helper yet. Gate manually:

```ts
const slow_system: System = (w, ctx) => {
  if (ctx.time.tick % 30 !== 0) return;  // every 30 ticks (= 0.5s at 60Hz)
  // ...
};
```

(*Candidate addition for future versions — flag this if you find yourself doing it a lot.*)

### 11.10 Plugin pattern

The `(world, schedule) => void` plugin shape is the canonical way to package a feature:

```ts
import type { Schedule, World } from "@f0rbit/forge";

export const game_plugin = (_w: World, sch: Schedule): void => {
  sch.add("startup", setup,                "coin.setup");
  sch.add("update",  player_input_system,  "coin.input");
  sch.add("update",  movement_system,      "coin.movement");
  sch.add("update",  collection_system,    "coin.collect");
};
```

Then in `main.ts`:

```ts
const r = await boot({...});
if (r.ok) game_plugin(r.value.world, r.value.schedule);
```

And in tests:

```ts
const h = harness({...});
game_plugin(h.world, h.schedule);
```

---

## 12. Troubleshooting / gotchas

### Black canvas

Most likely:

- Entities don't have `sprite_c`. The PIXI sprite-sync watches `(pos_c, sprite_c)` — both required.
- Wrong `texture` / `frame` alias. Open the palette (\`) and run `inspect <id>` to see the live data.
- Camera scale is 0 (host window too small). The `compute_scale` fallback kicks in; check the `console.warn`.
- Forge version. v0.1.1 had a cross-bundle component identity bug — you'd see a black canvas because the `pos_c` from the consumer didn't match the `pos_c` inside `/pixi`. Fixed in v0.1.2 via `Symbol.for`.

### `npm install` fails on peer dep

`pixi.js@^8` is a *peer* dependency. `bun add` is more lenient than `npm` here. If `npm install` complains:

```sh
npm install pixi.js@^8 @f0rbit/forge
```

### Cross-bundle component identity

`component("foo") === component("foo")` is true (the `key` symbols match) because both use `Symbol.for("forge.component:foo")`. The same applies to `resource("bar")`.

If you ever see `world.has(id, my_c)` returning `false` when it shouldn't — check that the consumer's component module isn't mismatched (e.g., one bundled with `tsc` flagging strictly while another targets ESM). The `Symbol.for` registry sidesteps this; just don't manually construct `Component` literals (use `component<T>(name)`).

### Frame name conventions

The `__default__` atlas frames are named `__default_0__`, `__default_1__`, `__default_2__`, `__default_3__` — underscore-padded so they sort lexically. Bring-your-own atlases use whatever names your TexturePacker output produces.

`assets.atlas(alias, url)` parses the JSON and reads `frames[name]` and `animations[seq] = ["frame_a", "frame_b", ...]`. The animation names you `play()` must match the JSON keys exactly.

### Query iteration + mutation

If you see this warning:

```
[forge] world.query([pos, coin]) iterator detected mid-iteration mutation.
```

You're calling `despawn`, `remove`, or `set` on a component the iterator is tracking, mid-loop. Two fixes:

1. `q.collect()` first: `for (const ... of q.collect()) { w.despawn(...); }`
2. Restructure the loop to defer the mutation: collect ids into an array, despawn after.

Production builds skip the check — the underlying behavior is the same (undefined iterator state) but you won't see the warning.

### Time vs viewport scale

- **`time.scale`** — game-time multiplier. `0.5` = slow-mo, `2.0` = fast-forward, `0` = paused. Writable.
- **`camera.viewport().scale`** — pixel scale (integer in pixel-perfect modes). Read-only; controlled by camera mode + window size.

The HUD label is `tscale` (time-scale) — it always reports `time.scale`. The palette command is also `tscale`.

### FP drift on `fixed_dt: 1/60`

Pre-v0.1.x replays might have stored `t.elapsed` as an accumulated float. v0.1.x stores `tick` (int) and computes `elapsed = tick * fixed_dt` on read. If you have an old replay JSON, regenerate it — load it, play it through, save the resulting state. (For action-stream replays this isn't an issue; only snapshot files need migration.)

### `engine_store` save vs ad-hoc store

Two separate ways to use the storage subpath:

- **`engine_store({...})`** — composite of three sub-stores (snapshots, bindings, prefs) over one corpus instance. Use this when you want all engine data in one place.
- **`mem({ schema })` / `file({ dir, schema })`** — single ad-hoc `Store<T>` for game-defined data (highscores, settings, level unlock state).

You can have both at once. `engine_store` and ad-hoc stores don't share a corpus — they're independent.

### `harness.tick` only runs `update`

By design — most unit tests want minimal state churn. To test render-stage behaviour or the full pipeline, use `h.schedule.tick(h.world, h.ctx)` instead.

---

## 13. Extending forge

### Adding new components in your game

```ts
// game/src/components.ts
import { component, type Component } from "@f0rbit/forge";

export const hp_c:    Component<{ value: number; max: number }> = component("hp");
export const enemy_c: Component<{ aggro: number }>              = component("enemy");
export const tag_c:   Component<true>                           = component("tag");
```

Always export the component descriptor. Importers reference it by the exported binding, never reconstruct it inline.

### Custom presets

Just a `Bindings` value:

```ts
// game/src/presets.ts
import type { Bindings } from "@f0rbit/forge";
import { presets } from "@f0rbit/forge/presets";
import { merge_bindings } from "@f0rbit/forge";

export const my_preset: Bindings = merge_bindings(presets.platformer, {
  digital: {
    interact: [{ kind: "key", code: "KeyE" }],
  },
  axes: {},
  deadzone: 0.15,
});
```

### Custom palette commands

Useful for "level editor in dev mode":

```ts
const spawn_at_cmd: Command<readonly [number, number]> = {
  name: "spawn",
  desc: "spawn an enemy at (x, y)",
  args: z.tuple([z.number(), z.number()]),
  run: ([x, y], _ctx) => {
    world.spawn([pos_c, { x, y }], [enemy_c, { aggro: 1 }]);
    return ok(`spawned enemy at ${x},${y}`);
  },
};

palette.register(spawn_at_cmd);
```

Wrap the registration in `if (is_dev())` to keep it out of production builds.

### Custom debug pins

The `Pin` data field is `unknown`. Push whatever shape you want:

```ts
debug.pin(boss, { kind: "label", data: `hp: ${hp.value}/${hp.max}`, ttl: 0 });
debug.pin(boss, { kind: "arrow", data: { tx: target.x, ty: target.y }, ttl: 0 });

// in your render system, read them back:
for (const pin of debug.pinned()) {
  if (pin.kind === "arrow") {
    const { tx, ty } = pin.data as { tx: number; ty: number };
    const pos = world.get(pin.id, pos_c);
    if (pos.ok) debug.line(pos.value, { x: tx, y: ty }, "yellow");
  }
}
```

### Cross-game shared modules

For a stable of small games sharing components, vendor a tiny NPM package:

```
@you/shared-components
├── package.json
└── src/
    ├── index.ts             # exports pos_c-style descriptors
    └── ...
```

Because component identity is `Symbol.for(...)`-based, two games consuming the same shared package via different forge versions still produce matching keys.

---

## 14. Deployment

### Building a game

```sh
# game repo
bun build src/main.ts --outdir dist --target browser
```

Or rolldown / vite / webpack — the choice is yours; forge is plain ESM.

For a static site, drop `index.html` next to `dist/main.js`:

```html
<!doctype html>
<html>
  <body>
    <div id="root"></div>
    <script type="module" src="./dist/main.js"></script>
  </body>
</html>
```

### GitHub Pages

The `coin-collector` repo's workflow is the canonical example: build on push to main, deploy `dist/` + `index.html` to `gh-pages`.

```yaml
# .github/workflows/pages.yml
on: { push: { branches: [main] } }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    permissions: { pages: write, id-token: write }
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

### Astro embed

Pattern via `forbit-astro` is **TBD** — link out to a future doc when it's written. Short version: dynamically import the game module on the client, mount onto a div, listen for visibility events to start/stop.

### Tauri (post-v1)

For itch.io or Steam wrappers, Tauri 2 hosts a webview around the same `dist/` bundle. No engine changes needed — the engine is browser-pure.

---

## 15. Versioning

### Pre-1.0 policy

`@f0rbit/forge` is **0.1.x** and breaking changes can land in any patch bump. The user is the only published consumer (`coin-collector`) so churn is cheap. The `CHANGELOG.md` will spell out what broke each release.

This policy ends at 1.0. Until then:

- Pin to an exact patch version (`"@f0rbit/forge": "0.1.4"`) if you want stability.
- Use a caret range (`"^0.1.4"`) and live with possible breakage on `0.2.x`.
- Watch the `CHANGELOG.md` before upgrading.

### Publish flow

The repo publishes via GitHub Actions OIDC trusted publisher — no `NPM_TOKEN` in the repo. Workflow:

1. Bump `package.json` version + add a changeset entry.
2. Push to `main`.
3. CI runs typecheck + tests + build, then `npm publish`. If the version on `main` already exists on npm, publish-skip is a no-op (intended — docs-only commits don't churn npm).

You don't publish manually. (Don't try.)

---

## 16. Reference — exports table

### `@f0rbit/forge` (main)

| Export | Kind | Signature / shape |
|---|---|---|
| `world` | factory | `() => World` |
| `component` | factory | `<T>(name: string) => Component<T>` |
| `internal` | symbol | escape hatch — see `World[internal]` |
| `pos_c` | const | `Component<{ x, y }>` |
| `World` | type | core ECS |
| `Component<T>` | type | branded descriptor |
| `Id` | type | branded number |
| `Query<C>` | type | iterable + `.each` + `.collect` |
| `QueryOpts` | type | `{ without?: Component<any>[] }` |
| `ComponentTuple<C>` | type | helper |
| `WorldInternal` | type | escape-hatch interface |
| `schedule` | factory | `() => Schedule` |
| `Schedule` | type | `{ add, remove, tick, run, stages }` |
| `Stage` | type | `"startup" \| "pre" \| "update" \| "post" \| "render" \| string` |
| `System` | type | `(w: World, ctx: Ctx) => void` |
| `Ctx` | type | `{ time, rng, res, input, debug, palette, store? }` |
| `time` | factory | `(opts?: { fixed_dt?: number }) => Time` |
| `Time` | type | `{ tick, fixed_dt, elapsed, alpha, scale, advance, restore }` |
| `rng` | factory | `(seed: number) => Rng` |
| `Rng` | type | `{ seed, next, int, pick, fork, state, restore }` |
| `resources` | factory | `() => Resources` |
| `resource` | factory | `<T>(name: string) => ResKey<T>` |
| `Resources`, `ResKey<T>` | type | symbol-keyed registry |
| `anim`, `anim_c`, `atlas_registry`, `anim_events` | factory + consts | animation system |
| `Anim`, `AnimData`, `AnimEvent`, `AnimEventBuffer`, `AtlasFrame`, `AtlasRegistry`, `AtlasSequences` | type | — |
| `input`, `noop_source`, `scripted`, `ticked`, `empty_bindings`, `merge_bindings` | factory + helpers | input layer |
| `Input`, `ActionState`, `RawInput`, `InputSource`, `PadIndex`, `Bindings`, `Trigger`, `AxisBinding`, `Action` | type | — |
| `replay` | namespace | `{ record, record_engine, play, save, load, schema }` |
| `ReplayDoc`, `ActionEvent`, `ReplayError`, `Recorder`, `Player` | type | — |
| `snapshotter`, `snapshot_schema` | factory + zod schema | persistence kernel |
| `Snapshot`, `SnapshotMeta`, `EntitySnap`, `Snapshotter`, `TakeOpts`, `RestoreOpts` | type | — |
| `mem`, `file`, `store`, `save`, `load`, `engine_store`, `bindings_schema`, `prefs_schema`, `default_prefs` | factory + helpers | re-exported from `/storage` for convenience |
| `Store<T>`, `Slot`, `SaveHandle`, `SaveSlot`, `StoreError`, `MemOpts<T>`, `FileOpts<T>`, `StoreOpts<T>`, `SaveError`, `EngineStore`, `EngineStoreOpts`, `Prefs` | type | — |
| `debug`, `debug_noop`, `is_dev` | factory + helper | debug subsystem |
| `Debug`, `DebugOpts`, `DebugCmd`, `DebugStats`, `Pin`, `PinKind`, `Color`, `Inspection`, `ComponentInspection` | type | — |
| `palette`, `palette_noop`, `builtins`, `tokenise`, `parse_line`, `fuzzy_score`, `fuzzy_rank` | factory + helpers | command palette |
| `Palette`, `PaletteOpts`, `Command<A>`, `CommandError`, `CommandRunner<A>`, `SearchHit`, `BuiltinDeps`, `ParsedLine` | type | — |
| `vec2`, `Vec2` | factory + type | `{ x, y }` |
| `EngineError` | type | union of every kernel error kind |
| `harness`, `Harness`, `HarnessOpts` | factory + types | test harness |

### `@f0rbit/forge/pixi`

| Export | Kind | Signature / shape |
|---|---|---|
| `boot` | async factory | `(opts: BootOpts) => Promise<Result<App, BootError>>` |
| `App`, `BootOpts`, `BootError`, `AssetSpec` | type | — |
| `assets` | factory | `(opts?: AssetsOpts) => Assets` |
| `Assets`, `AssetsOpts`, `AssetError` | type | — |
| `browser_source` | factory | `(opts?: BrowserSourceOpts) => BrowserSource` |
| `BrowserSource`, `BrowserSourceOpts` | type | — |
| `camera` | factory | `(opts: CameraOpts) => Camera` |
| `Camera`, `CameraOpts`, `CameraMode`, `Viewport` | type | — |
| `make_render` | async factory | `(opts: RenderOpts) => Promise<Result<RenderState, RenderError>>` |
| `RenderState`, `RenderError`, `RenderOpts` | type | — |
| `sprite_c`, `sprite_sync_system` | const + factory | sprite ECS bridge |
| `SpriteData`, `SpriteSystemOpts` | type | — |
| `anim_sync_system` | factory | `(opts: AnimPixiOpts) => System` |
| `AnimPixiOpts` | type | — |
| `debug_pixi` | factory | `(opts: DebugPixiOpts) => System` |
| `DebugPixiOpts` | type | — |
| `palette_pixi` | factory | `(opts: PalettePixiOpts) => PaletteUI` |
| `PalettePixiOpts` | type | — |

### `@f0rbit/forge/debug`

| Export | Kind |
|---|---|
| `debug`, `debug_noop`, `is_dev` | factory + helper |
| `Debug`, `DebugOpts`, `Color`, `DebugCmd`, `DebugStats`, `Pin`, `PinKind`, `ComponentInspection`, `Inspection` | type |

### `@f0rbit/forge/storage`

| Export | Kind |
|---|---|
| `snapshotter`, `snapshot_schema` | factory + zod schema |
| `mem`, `file`, `store` | factory |
| `save`, `load` | helpers (compose snapshotter + store) |
| `engine_store`, `bindings_schema`, `prefs_schema`, `default_prefs` | factory + zod schemas |
| `Snapshot`, `SnapshotMeta`, `EntitySnap`, `Snapshotter`, `TakeOpts`, `RestoreOpts`, `Store<T>`, `Slot`, `SaveHandle`, `SaveSlot`, `StoreError`, `MemOpts<T>`, `FileOpts<T>`, `StoreOpts<T>`, `SaveError`, `EngineStore`, `EngineStoreOpts`, `Prefs` | type |

### `@f0rbit/forge/presets`

| Export | Kind | Actions |
|---|---|---|
| `presets.movement2d` | `Bindings` | `move.x`, `move.y` (axes) |
| `presets.movement8way` | `Bindings` | `move.{left,right,up,down}` (digital) + `move.x`, `move.y` (axes) |
| `presets.platformer` | `Bindings` | `jump` (digital), `move.x` (axis) |
| `presets.twinstick` | `Bindings` | `move.x`, `move.y`, `aim.x`, `aim.y` (axes) |
| `presets.menu` | `Bindings` | `up`, `down`, `left`, `right`, `confirm`, `cancel` (digital) |

---

*This document is for forge v0.1.4. For older versions, check the `CHANGELOG.md` — breaking-change notes spell out the migration. For design rationale (why these decisions), see `PLAN.md`.*
