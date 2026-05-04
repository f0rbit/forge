# @f0rbit/forge

A small, functional, composition-first TypeScript game engine published as a single npm package with subpath exports. PIXI v8 is consumed strictly as a renderer + asset loader at the edge (`@f0rbit/forge/pixi`, peer-dep on `pixi.js`); everything else (ECS, scheduling, input, time, RNG, replay, persistence, debug, palette) is renderer-agnostic and runs headless under `bun test`. Determinism is a hard guarantee, not an aspiration.

See [`PLAN.md`](./PLAN.md) for the full design doc and [`CHANGELOG.md`](./CHANGELOG.md) for release notes.

## Install

```sh
bun add @f0rbit/forge
bun add pixi.js   # only if you use the @f0rbit/forge/pixi subpath
```

## Subpaths

```ts
import { /* engine core */ } from "@f0rbit/forge"
import { presets }          from "@f0rbit/forge/presets"
import { debug }            from "@f0rbit/forge/debug"
import { engine_store }     from "@f0rbit/forge/storage"
import { boot }             from "@f0rbit/forge/pixi"
```

## Getting started

```ts
import { component } from "@f0rbit/forge";
import { boot } from "@f0rbit/forge/pixi";
import { presets } from "@f0rbit/forge/presets";

const pos = component<{ x: number; y: number }>("pos");
const vel = component<{ dx: number; dy: number }>("dx");

const r = await boot({
  mount: "#game",
  width: 640,
  height: 360,
  bindings: presets.movement2d,
  assets: [
    { kind: "atlas", alias: "hero", url: "/sprites/hero.json" },
  ],
});
if (!r.ok) throw new Error(`boot failed: ${r.error.kind}`);
const { world, schedule, input, ctx, start } = r.value;

const player = world.spawn(
  [pos, { x: 100, y: 100 }],
  [vel, { dx: 0, dy: 0 }],
);

schedule.add("update", (w, c) => {
  const [dx, dy] = c.input.vector("move.x", "move.y");
  const v = w.get(player, vel);
  if (v.ok) w.set(player, vel, { dx: dx * 60, dy: dy * 60 });
}, "input.move");

schedule.add("update", (w, c) => {
  for (const [, p, v] of w.query([pos, vel] as const)) {
    p.x += v.dx * c.time.fixed_dt;
    p.y += v.dy * c.time.fixed_dt;
  }
}, "movement");

start();
```

WASD/arrow keys move the player; F1 toggles the debug overlay; backtick opens the command palette.

## Build & test

```sh
bun install
bun run build
bun test
bun run check:determinism
```

## Design philosophy

- Records of functions over private state — no classes, no inheritance.
- Single-word, lowercase API: `world.spawn`, `time.advance`, `input.pressed("jump")`.
- Deterministic by construction. Browser non-determinism is quarantined to `src/pixi/`.
- `Result<T, E>` everywhere (`@f0rbit/corpus`). Never throw, never try/catch outside foreign-call boundaries.
- Test in-memory first; PIXI is a thin adapter, not a dependency of the kernel.

`@f0rbit/forge` is v0.x — APIs may break between minor versions until v1.0.
