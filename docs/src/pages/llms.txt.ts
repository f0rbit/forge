import type { APIRoute } from "astro";
import { sections } from "../data/exports";

const intro = [
	"# @f0rbit/forge",
	"",
	"TypeScript game engine on PIXI v8. Single-package, ESM-only, deterministic kernel + quarantined renderer.",
	"",
	"- Repo: https://github.com/f0rbit/forge",
	"- Docs: https://f0rbit.github.io/forge",
	"- License: MIT",
	"",
	"Five subpath exports:",
	"",
	"- `@f0rbit/forge` — engine kernel (ECS, schedule, time, rng, resources, input, replay, anim, snapshot, palette, debug)",
	"- `@f0rbit/forge/pixi` — PIXI v8 integration (boot, camera, sprite/anim sync, palette UI, debug overlay)",
	"- `@f0rbit/forge/debug` — standalone debug subsystem",
	"- `@f0rbit/forge/storage` — persistence (snapshotter, Store<T>, save/load, engine_store)",
	"- `@f0rbit/forge/presets` — pre-built input bindings (movement2d, platformer, twinstick, menu, ...)",
	"",
	"Hard rules:",
	"",
	"- ESM-only. Node 20+ / modern browsers.",
	"- Determinism contract: no Date.now / Math.random / setTimeout outside `src/pixi`. Use `time` and `rng` resources.",
	"- Errors as values via `@f0rbit/corpus` Result<T, E>. Never throws.",
	"- snake_case data fields, camelCase functions, PascalCase types, kebab-case files.",
	"",
];

const install_snippet = [
	"## Installation",
	"",
	"```sh",
	"bun add @f0rbit/forge",
	"bun add pixi.js   # only needed for @f0rbit/forge/pixi",
	"```",
	"",
	"## Subpath imports",
	"",
	"```ts",
	'import { /* engine core */ } from "@f0rbit/forge";',
	'import { presets }            from "@f0rbit/forge/presets";',
	'import { /* debug types */ }  from "@f0rbit/forge/debug";',
	'import { engine_store }       from "@f0rbit/forge/storage";',
	'import { boot, sprite_c }     from "@f0rbit/forge/pixi";',
	"```",
	"",
];

const quickstart_snippet = [
	"## Quick start — minimal hello-sprite",
	"",
	"```ts",
	'import { component, pos_c } from "@f0rbit/forge";',
	'import { boot, sprite_c }   from "@f0rbit/forge/pixi";',
	'import { presets }          from "@f0rbit/forge/presets";',
	"",
	'const player_c = component<true>("player");',
	"",
	"const r = await boot({",
	'  mount: "#root",',
	"  window: { width: globalThis.innerWidth, height: globalThis.innerHeight },",
	'  camera: { design: { width: 320, height: 180 }, mode: "letterbox" },',
	"  bindings: presets.movement2d,",
	"});",
	"if (!r.ok) throw new Error(`boot failed: ${r.error.kind}`);",
	"const app = r.value;",
	"",
	"app.world.spawn(",
	"  [pos_c, { x: 160, y: 90 }],",
	"  [player_c, true],",
	'  [sprite_c, { texture: "__default__", frame: "__default_0__", anchor: { x: 0.5, y: 0.5 } }],',
	");",
	"",
	'app.schedule.add("update", (w, ctx) => {',
	'  const [dx, dy] = ctx.input.vector("move.x", "move.y");',
	"  for (const [, p] of w.query([pos_c, player_c] as const)) {",
	"    p.x += dx * 60 * ctx.time.fixed_dt;",
	"    p.y += dy * 60 * ctx.time.fixed_dt;",
	"  }",
	'}, "player.move");',
	"",
	"app.start();",
	"```",
	"",
];

const harness_snippet = [
	"## Headless test harness",
	"",
	"```ts",
	'import { harness, pos_c, component } from "@f0rbit/forge";',
	"",
	'const player_c = component<true>("player");',
	"const h = harness({ seed: 1, fixed_dt: 1 / 60 });",
	"",
	"h.world.spawn([pos_c, { x: 0, y: 0 }], [player_c, true]);",
	'h.schedule.add("update", (w, ctx) => {',
	"  for (const [, p] of w.query([pos_c, player_c] as const)) {",
	"    p.x += ctx.time.fixed_dt;",
	"  }",
	'}, "tick");',
	"",
	"h.run(60);",
	"// world is now 60 ticks ahead, deterministic",
	"```",
	"",
];

const determinism_snippet = [
	"## Determinism contract",
	"",
	"- Browser non-determinism (Date.now, Math.random, setTimeout, requestAnimationFrame) is allowed only inside `src/pixi/`.",
	"- The kernel uses `time` (fixed-step accumulator) and `rng` (seeded splittable PRNG) resources for all timing and randomness.",
	"- Schedule order is insertion-stable. Queries iterate the smallest store first, sorted by entity id.",
	"- Replays serialise the action event stream + the seed; replaying a recorded session is byte-identical to the original.",
	"- The `tools/no-throws.ts` lint script enforces no-throws, no-banned-globals outside `src/pixi/`.",
	"",
];

const renderEntry = (entry: { name: string; kind: string; signature?: string; description: string }): string => {
	const sig = entry.signature ? ` — \`${entry.signature}\`` : "";
	return `- **${entry.name}** (${entry.kind})${sig} — ${entry.description}`;
};

export const GET: APIRoute = () => {
	const lines: string[] = [];

	for (const line of intro) lines.push(line);
	for (const line of install_snippet) lines.push(line);
	for (const line of quickstart_snippet) lines.push(line);
	for (const line of harness_snippet) lines.push(line);
	for (const line of determinism_snippet) lines.push(line);

	lines.push("## Public surface");
	lines.push("");

	for (const section of sections) {
		lines.push(`### ${section.subpath}`);
		lines.push("");
		lines.push(section.description);
		lines.push("");

		for (const category of section.categories) {
			lines.push(`#### ${category.name}`);
			if (category.description) {
				lines.push("");
				lines.push(category.description);
			}
			lines.push("");
			for (const entry of category.exports) {
				lines.push(renderEntry(entry));
			}
			lines.push("");
		}
	}

	lines.push("## See also");
	lines.push("");
	lines.push("- Full reference table: https://f0rbit.github.io/forge/reference");
	lines.push("- Per-page guides under each section in the sidebar at https://f0rbit.github.io/forge");
	lines.push("- Example consumer: https://github.com/f0rbit/coin-collector");
	lines.push("");

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
