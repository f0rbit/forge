import { describe, expect, test } from "bun:test";
import { Container } from "pixi.js";
import { world, time, rng, resources, input, debug_noop, palette_noop, type Ctx } from "../../src/index.ts";
import { component } from "../../src/world.ts";
import { assets, sprite, sprite_c, sprite_sync_system } from "../../src/pixi/index.ts";
import { sprite_node_for } from "../../src/pixi/sprite.ts";

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
			[sprite_c, { texture: "missing" }],
		);

		sys(w, ctx);
		expect(root.children.length).toBe(1);
		expect(sprite_node_for(w, id)).toBeDefined();
	});

	test("tracks position changes between ticks", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false });
		const root = new Container();
		const sys = sprite_sync_system({ assets: a, world_container: root, pos_component: pos });

		const id = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x" }],
		);
		sys(w, ctx);
		w.set(id, pos, { x: 100, y: 200 });
		sys(w, ctx);
		const node = sprite_node_for(w, id);
		expect(node!.position.x).toBe(100);
		expect(node!.position.y).toBe(200);
	});

	test("destroys nodes for despawned entities on next sync", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false });
		const root = new Container();
		const sys = sprite_sync_system({ assets: a, world_container: root, pos_component: pos });

		const id = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x" }],
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
			[sprite_c, { texture: "x", anchor: { x: 0.5, y: 0.5 }, tint: 0xff00ff }],
		);
		sys(w, ctx);
		const node = sprite_node_for(w, id);
		expect(node!.anchor.x).toBe(0.5);
		expect(node!.anchor.y).toBe(0.5);
		expect(node!.tint).toBe(0xff00ff);
	});

	test("applies scale when set; leaves node at default 1x1 when omitted", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false });
		const root = new Container();
		const sys = sprite_sync_system({ assets: a, world_container: root, pos_component: pos });

		const scaled = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x", scale: { x: 2, y: 3 } }],
		);
		const plain = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x" }],
		);
		sys(w, ctx);
		const a_node = sprite_node_for(w, scaled);
		expect(a_node!.scale.x).toBe(2);
		expect(a_node!.scale.y).toBe(3);
		const b_node = sprite_node_for(w, plain);
		expect(b_node!.scale.x).toBe(1);
		expect(b_node!.scale.y).toBe(1);
	});

	test("applies alpha when set; leaves node at default 1.0 when omitted", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false });
		const root = new Container();
		const sys = sprite_sync_system({ assets: a, world_container: root, pos_component: pos });

		const dimmed = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x", alpha: 0.4 }],
		);
		const plain = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x" }],
		);
		sys(w, ctx);
		const a_node = sprite_node_for(w, dimmed);
		expect(a_node!.alpha).toBe(0.4);
		const b_node = sprite_node_for(w, plain);
		expect(b_node!.alpha).toBe(1);
	});

	test("alpha changes between frames update the node", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false });
		const root = new Container();
		const sys = sprite_sync_system({ assets: a, world_container: root, pos_component: pos });

		const id = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x", alpha: 1 }],
		);
		sys(w, ctx);
		const before = sprite_node_for(w, id);
		expect(before!.alpha).toBe(1);

		sprite.set(w, id, { alpha: 0.25 });
		sys(w, ctx);
		const after = sprite_node_for(w, id);
		expect(after!.alpha).toBe(0.25);
	});

	test("scale changes between frames update the node", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false });
		const root = new Container();
		const sys = sprite_sync_system({ assets: a, world_container: root, pos_component: pos });

		const id = w.spawn(
			[pos, { x: 0, y: 0 }],
			[sprite_c, { texture: "x", scale: { x: 1, y: 1 } }],
		);
		sys(w, ctx);
		const before = sprite_node_for(w, id);
		expect(before!.scale.x).toBe(1);

		sprite.set(w, id, { scale: { x: 4, y: 0.5 } });
		sys(w, ctx);
		const after = sprite_node_for(w, id);
		expect(after!.scale.x).toBe(4);
		expect(after!.scale.y).toBe(0.5);
	});
});

describe("sprite helpers", () => {
	test("sprite.set patches the existing component without spreading the prior fields manually", () => {
		const w = world();
		const id = w.spawn([sprite_c, { texture: "x", tint: 0xff0000 }]);
		const r = sprite.set(w, id, { tint: 0x00ff00 });
		expect(r.ok).toBe(true);
		const cur = w.get(id, sprite_c);
		expect(cur.ok && cur.value.tint).toBe(0x00ff00);
		expect(cur.ok && cur.value.texture).toBe("x");
	});

	test("sprite.show toggles visible: true", () => {
		const w = world();
		const id = w.spawn([sprite_c, { texture: "x", visible: false }]);
		sprite.show(w, id);
		const cur = w.get(id, sprite_c);
		expect(cur.ok && cur.value.visible).toBe(true);
	});

	test("sprite.hide toggles visible: false", () => {
		const w = world();
		const id = w.spawn([sprite_c, { texture: "x", visible: true }]);
		sprite.hide(w, id);
		const cur = w.get(id, sprite_c);
		expect(cur.ok && cur.value.visible).toBe(false);
	});

	test("sprite.set on missing entity returns an error", () => {
		const w = world();
		const r = sprite.set(w, 999 as never, { tint: 0 });
		expect(r.ok).toBe(false);
	});
});
