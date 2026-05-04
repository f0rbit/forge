import { describe, expect, test } from "bun:test";
import { BufferImageSource, Spritesheet, Texture } from "pixi.js";
import { world, time, rng, resources, input, debug_noop, palette_noop, atlas_registry, anim_c, type Ctx } from "../../src/index.ts";
import { component } from "../../src/world.ts";
import { assets, sprite_c, anim_sync_system } from "../../src/pixi/index.ts";

const pos = component<{ x: number; y: number }>("pos");

const make_sheet = (): Spritesheet => {
	const pixels = new Uint8Array(48 * 16 * 4);
	const src = new BufferImageSource({ resource: pixels, width: 48, height: 16, alphaMode: "premultiply-alpha-on-upload" });
	const tex = new Texture({ source: src });
	const data = {
		frames: {
			a: { frame: { x: 0, y: 0, w: 16, h: 16 }, duration: 100 },
			b: { frame: { x: 16, y: 0, w: 16, h: 16 }, duration: 100 },
			c: { frame: { x: 32, y: 0, w: 16, h: 16 }, duration: 100 },
		},
		animations: { walk: ["a", "b", "c"] },
		meta: { format: "RGBA8888", size: { w: 48, h: 16 }, scale: 1 },
	};
	const sheet = new Spritesheet(tex as never, data as never);
	sheet.parseSync();
	return sheet;
};

const make_ctx = (): Ctx => {
	const t = time();
	const res = resources();
	return {
		time: t,
		rng: rng(1),
		res,
		input: input(),
		debug: debug_noop(),
		palette: palette_noop(),
	};
};

describe("anim_sync_system", () => {
	test("binds the texture for the current frame", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false, fixed_dt: ctx.time.fixed_dt });
		const sheet = make_sheet();
		a.register_atlas("hero", sheet);
		ctx.res.set(atlas_registry, a.registry());

		const sys = anim_sync_system({ assets: a });
		const id = w.spawn(
			[pos, { x: 0, y: 0 }],
			[anim_c, { atlas: "hero", sequence: "walk", frame: 1, t: 0, speed: 1, loop: true, done: false }],
			[sprite_c, { texture: "hero", node: { texture: null } as never }],
		);

		sys(w, ctx);
		const sd = w.get(id, sprite_c);
		expect(sd.ok && sd.value.node!.texture).toBe(sheet.textures["b"] as Texture);
	});

	test("falls back to __default__ atlas when alias missing", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: true, fixed_dt: ctx.time.fixed_dt });
		ctx.res.set(atlas_registry, a.registry());

		const sys = anim_sync_system({ assets: a });
		w.spawn(
			[pos, { x: 0, y: 0 }],
			[anim_c, { atlas: "ghost", sequence: "spin", frame: 0, t: 0, speed: 1, loop: true, done: false }],
			[sprite_c, { texture: "ghost", node: { texture: null } as never }],
		);

		sys(w, ctx);
	});

	test("clamps frame index when oversize and uses last frame", () => {
		const w = world();
		const ctx = make_ctx();
		const a = assets({ register_default: false, fixed_dt: ctx.time.fixed_dt });
		const sheet = make_sheet();
		a.register_atlas("hero", sheet);
		ctx.res.set(atlas_registry, a.registry());

		const sys = anim_sync_system({ assets: a });
		const id = w.spawn(
			[pos, { x: 0, y: 0 }],
			[anim_c, { atlas: "hero", sequence: "walk", frame: 99, t: 0, speed: 1, loop: false, done: true }],
			[sprite_c, { texture: "hero", node: { texture: null } as never }],
		);

		sys(w, ctx);
		const sd = w.get(id, sprite_c);
		expect(sd.ok && sd.value.node!.texture).toBe(sheet.textures["c"] as Texture);
	});
});
