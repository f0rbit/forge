# @f0rbit/forge

A small, functional, composition-first TypeScript game engine published as a single npm package with subpath exports. PIXI.js is consumed strictly as a renderer + asset loader at the edge (`@f0rbit/forge/pixi`, peer-dep on `pixi.js`); everything else (ECS, scheduling, input, time, RNG, replay, persistence, debug, palette) is renderer-agnostic and runs headless under `bun test`. Determinism is a hard guarantee, not an aspiration.

See [`PLAN.md`](./PLAN.md) for the full design doc.

## Install

```sh
bun add @f0rbit/forge
bun add pixi.js   # only if you use the @f0rbit/forge/pixi subpath
```

## Build

```sh
bun install
bun run build
bun test
```

## Subpaths

```ts
import { /* engine core */ } from "@f0rbit/forge"
import { presets }          from "@f0rbit/forge/presets"
import { debug }            from "@f0rbit/forge/debug"
import { store }            from "@f0rbit/forge/storage"
import { boot }             from "@f0rbit/forge/pixi"
```
