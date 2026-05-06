@~/.claude/AGENTS.md

# @f0rbit/forge — agent notes

This repo IS the npm package `@f0rbit/forge`. The `dist/` output is what ships. Game source NEVER lives here — games are separate repos that consume forge from npm (or via `bun link` during dev).

## Package shape

- Single published package, ESM-only, five subpath exports: `.`, `./pixi`, `./debug`, `./storage`, `./presets`.
- Every public entry point is one of those five subpaths. New surface = a deliberate edit to the `exports` map in `package.json` and a new `src/<sub>/index.ts` barrel. Nothing is exported by accident.
- `src/index.ts` is the main entry (ECS / schedule / time / rng / resources / input / replay / anim / snapshot / palette).
- `src/pixi/` is the **only** directory allowed to import `pixi.js` or `@pixi/*`. All renderer-coupled code lives here.

## Build chain

- **Rolldown** bundles JS (`rolldown -c`). Multi-entry config in `rolldown.config.ts`, one entry per subpath, externalises `@f0rbit/corpus`, `zod`, `pixi.js`, `@pixi/*`.
- **`tsc -p tsconfig.build.json`** emits `.d.ts` only (declarations are a separate pass; Rolldown does not currently do dts).
- `bun run build` chains `clean -> rolldown -> tsc`. Output: `dist/<sub>/index.js` + `dist/<sub>/index.d.ts` matching the `exports` map exactly.
- ESM-only. No CJS for v1. `"sideEffects": false` for tree-shaking.

## Peer-dep policy

- `pixi.js` is `peerDependencies` (optional, `^8`). Consumers bring their own pixi; non-pixi consumers skip it entirely.
- `@f0rbit/corpus` and `zod` are direct `dependencies`. Don't drift without intent.
- Promote `zod` to peer-dep only if consumer-side version drift becomes a real problem.

## Code style overrides (project-specific)

- **Records of functions over classes.** Factories (`world()`, `time()`, `input()`, `debug()`, `palette()`, `store()`) return objects whose methods close over local state. No `this`, no inheritance.
- **Single-word, lowercase API.** `world.spawn`, `time.advance`, `input.pressed("jump")`, `debug.line(a, b)`, `palette.register(...)`, `store.save(...)`. Compound names only when truly necessary.
- **`@f0rbit/corpus` `Result<T, E>` at every fallible boundary.** Never throw, never try/catch. The single permitted try/catch site is wrapping a foreign call (PIXI, fs, Gamepad API).
- snake_case data fields, camelCase functions, PascalCase types, kebab-case files.
- No code comments unless genuinely non-obvious business logic.

## Determinism contract (hard rule)

- No `Date.now()`, no `Math.random()`, no `setTimeout` / `setInterval` outside `src/pixi/`. Use `time` and `rng` resources.
- Browser non-determinism is quarantined to `src/pixi/`.
- Insertion-ordered systems, sorted entity iteration, seeded RNG forks per subsystem.
- A `tools/no-throws.ts` lint script (added in Phase 2) enforces these globals + the no-pixi-outside-src/pixi rule.

## Testing

- Integration-first under `test/`. In-memory fakes / Provider pattern over mocks.
- Test helpers (`harness`, `scripted-source`, `snapshot-diff`) live under `test/helpers/` and are NOT part of the published surface.

## Release

- Manual `npm publish` for now; later wire to a GitHub Action with `NPM_TOKEN`.
- Changesets in single-package mode (added in Phase 5).

## Canonical design doc

`PLAN.md` is the source of truth for design until v1 ships. Read §3 (architecture), §4 (API surface), §8 (build), §9 (phases) before making API or structural changes.

## Documentation

Docs live in `docs/` as a private Astro Starlight workspace, modelled on `~/dev/corpus/docs` and `~/dev/ui/docs`. Theming uses `@f0rbit/ui` v0.1.x via `@f0rbit/ui/styles` + `@f0rbit/ui/styles/starlight`.

- Pages: `docs/src/content/docs/**/*.mdx` — MDX is the single source of truth. There is no `USAGE.md` (removed in v0.1.5; the docs site is the canonical reference).
- Sidebar config: `docs/astro.config.mjs`.
- Local dev: `bun run docs:dev` (preview at `localhost:4321/forge/`); `bun run docs:build` from the repo root surfaces broken sidebar slugs and link errors.
- Deploy: `.github/workflows/docs.yml` builds and publishes to `https://f0rbit.github.io/forge/` on push to `main` (or via `workflow_dispatch`). The library-build step is intentionally absent — the docs site pulls `@f0rbit/ui` from npm, not from `..`.
- The docs workspace is excluded from the published npm tarball (see `package.json` `files`).
