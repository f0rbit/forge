import { describe, expect, test } from "bun:test";
import { Container } from "pixi.js";
import { world, time, rng, resources, input, debug_noop, palette_noop, type Ctx } from "../../src/index.ts";
import { component } from "../../src/world.ts";
import { assets, sprite_c, sprite_sync_system } from "../../src/pixi/index.ts";

const pos = component<{ x: number; y: number }>("pos");

const make_ctx = (): Ctx => ({
	time: time(),
	rng: rng(1),
	res: resources(),
	input: input(),
	debug: debug_noop(),
	palette: palette_noop(),
});

describe("sprite_sync_system", () => {
	test("creates a Sprite child on first run and sets position", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false });
		const root = new Container();
		const sys = sprite_sync_system({ assets: a, world_container: root, pos_component: pos });

		const id = w.spawn(
			[pos, { x: 10, y: 20 }],
			[sprite_c, { texture: "missing", node: null }],
		);

		sys(w, ctx);
		expect(root.children.length).toBe(1);
		const sd = w.get(id, sprite_c);
		expect(sd.ok && sd.value.node).toBeDefined();
	});

	test("tracks position changes between ticks", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false });
		const root = new Container();
		const sys = sprite_sync_system({ assets: a, world_container: root, pos_component: pos });

		const id = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x", node: null }],
		);
		sys(w, ctx);
		w.set(id, pos, { x: 100, y: 200 });
		sys(w, ctx);
		const sd = w.get(id, sprite_c);
		expect(sd.ok && sd.value.node!.position.x).toBe(100);
		expect(sd.ok && sd.value.node!.position.y).toBe(200);
	});

	test("destroys nodes for despawned entities on next sync", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false });
		const root = new Container();
		const sys = sprite_sync_system({ assets: a, world_container: root, pos_component: pos });

		const id = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x", node: null }],
		);
		sys(w, ctx);
		expect(root.children.length).toBe(1);

		w.despawn(id);
		sys(w, ctx);
		expect(root.children.length).toBe(0);
	});

	test("applies anchor and tint", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false });
		const root = new Container();
		const sys = sprite_sync_system({ assets: a, world_container: root, pos_component: pos });

		const id = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x", anchor: { x: 0.5, y: 0.5 }, tint: 0xff00ff, node: null }],
		);
		sys(w, ctx);
		const sd = w.get(id, sprite_c);
		expect(sd.ok && sd.value.node!.anchor.x).toBe(0.5);
		expect(sd.ok && sd.value.node!.anchor.y).toBe(0.5);
		expect(sd.ok && sd.value.node!.tint).toBe(0xff00ff);
	});
});
