# @f0rbit/forge

A small, functional, composition-first TypeScript game engine published as a single npm package with subpath exports. PIXI v8 is consumed strictly as a renderer + asset loader at the edge (`@f0rbit/forge/pixi`, peer-dep on `pixi.js`); everything else (ECS, scheduling, input, time, RNG, replay, persistence, debug, palette) is renderer-agnostic and runs headless under `bun test`. Determinism is a hard guarantee, not an aspiration.

**Documentation**: <https://f0rbit.github.io/forge/>

> **Full API documentation lives in [`USAGE.md`](./USAGE.md)** — a comprehensive reference covering every subsystem, every export, the determinism contract, the camera math, a cookbook of common patterns, and worked examples lifted from the canonical consumer (`coin-collector`).

For the design doc see [`PLAN.md`](./PLAN.md); for release notes see [`CHANGELOG.md`](./CHANGELOG.md).

## Install

```sh
bun add @f0rbit/forge
bun add pixi.js   # only if you use the @f0rbit/forge/pixi subpath
```

## Subpaths

```ts
import { /* engine core */ } from "@f0rbit/forge";
import { presets }          from "@f0rbit/forge/presets";
import { /* debug types */ } from "@f0rbit/forge/debug";
import { engine_store }     from "@f0rbit/forge/storage";
import { boot, sprite_c }   from "@f0rbit/forge/pixi";
```

## Quick start

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

WASD/arrows/left stick move the player; F1 toggles debug; backtick (`` ` ``) opens the command palette.

For a full end-to-end consumer (replay tests, level setup, persistence), see the `coin-collector` repo.

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
