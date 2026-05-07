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

	test("applies scale when set; leaves node at default 1x1 when omitted", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false });
		const root = new Container();
		const sys = sprite_sync_system({ assets: a, world_container: root, pos_component: pos });

		const scaled = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x", scale: { x: 2, y: 3 }, node: null }],
		);
		const plain = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x", node: null }],
		);
		sys(w, ctx);
		const a_sd = w.get(scaled, sprite_c);
		expect(a_sd.ok && a_sd.value.node!.scale.x).toBe(2);
		expect(a_sd.ok && a_sd.value.node!.scale.y).toBe(3);
		const b_sd = w.get(plain, sprite_c);
		expect(b_sd.ok && b_sd.value.node!.scale.x).toBe(1);
		expect(b_sd.ok && b_sd.value.node!.scale.y).toBe(1);
	});

	test("scale changes between frames update the node", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false });
		const root = new Container();
		const sys = sprite_sync_system({ assets: a, world_container: root, pos_component: pos });

		const id = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x", scale: { x: 1, y: 1 }, node: null }],
		);
		sys(w, ctx);
		const before = w.get(id, sprite_c);
		expect(before.ok && before.value.node!.scale.x).toBe(1);

		if (before.ok) w.set(id, sprite_c, { ...before.value, scale: { x: 4, y: 0.5 } });
		sys(w, ctx);
		const after = w.get(id, sprite_c);
		expect(after.ok && after.value.node!.scale.x).toBe(4);
		expect(after.ok && after.value.node!.scale.y).toBe(0.5);
	});
});
