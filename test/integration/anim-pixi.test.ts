import { describe, expect, test } from "bun:test";
import { BufferImageSource, Spritesheet, Texture } from "pixi.js";
import {
	world,
	schedule,
	time,
	rng,
	resources,
	input,
	debug_noop,
	palette_noop,
	anim,
	anim_c,
	atlas_registry,
	type Ctx,
	type AtlasRegistry,
} from "../../src/index.ts";
import { component } from "../../src/world.ts";
import { assets, anim_sync_system, sprite_c, sprite_sync_system } from "../../src/pixi/index.ts";

const pos = component<{ x: number; y: number }>("pos");

const make_atlas_data = () => ({
	frames: {
		"f0.png": { frame: { x: 0, y: 0, w: 16, h: 16 }, duration: 100 },
		"f1.png": { frame: { x: 16, y: 0, w: 16, h: 16 }, duration: 100 },
		"f2.png": { frame: { x: 32, y: 0, w: 16, h: 16 }, duration: 100 },
	},
	animations: {
		walk: ["f0.png", "f1.png", "f2.png"],
	},
	meta: { format: "RGBA8888", size: { w: 48, h: 16 }, scale: 1 },
});

const make_test_sheet = (): Spritesheet => {
	const pixels = new Uint8Array(48 * 16 * 4);
	const source = new BufferImageSource({ resource: pixels, width: 48, height: 16, alphaMode: "premultiply-alpha-on-upload" });
	const tex = new Texture({ source });
	const sheet = new Spritesheet(tex as never, make_atlas_data() as never);
	sheet.parseSync();
	return sheet;
};

describe("anim-pixi integration", () => {
	test("sync system binds the right Texture for the current frame after anim.advance", () => {
		const w = world();
		const sch = schedule();
		const t = time();
		const r = rng(1);
		const res = resources();

		const a = assets({ fixed_dt: t.fixed_dt, register_default: false });
		const sheet = make_test_sheet();
		const reg_r = a.register_atlas("hero", sheet);
		expect(reg_r.ok).toBe(true);

		res.set(atlas_registry, a.registry() as AtlasRegistry);

		const ctx: Ctx = {
			time: t,
			rng: r,
			res,
			input: input(),
			debug: debug_noop(),
			palette: palette_noop(),
		};

		const an = anim();
		sch.add("update", an.advance, "anim.advance");
		sch.add("post", anim_sync_system({ assets: a, default_atlas: "hero" }), "anim.sync");

		const id = w.spawn(
			[pos, { x: 0, y: 0 }],
			[anim_c, { atlas: "hero", sequence: "walk", frame: 0, t: 0, speed: 1, loop: true, done: false }],
			[sprite_c, { texture: "hero", frame: "f0.png", node: { texture: sheet.textures["f0.png"] } as never }],
		);

		const advance_ticks = (n: number): void => {
			for (let i = 0; i < n; i++) {
				sch.run("update", w, ctx);
			}
			sch.run("post", w, ctx);
		};

		advance_ticks(0);
		const frame_after_zero = w.get(id, anim_c);
		expect(frame_after_zero.ok).toBe(true);

		const frame_ticks = a.registry()["hero"]!["walk"]![0]!.ticks;
		advance_ticks(frame_ticks);
		const a1 = w.get(id, anim_c);
		expect(a1.ok && a1.value.frame).toBe(1);
		const sd1 = w.get(id, sprite_c);
		expect(sd1.ok).toBe(true);
		if (sd1.ok && sd1.value.node) {
			expect(sd1.value.node.texture).toBe(sheet.textures["f1.png"] as Texture);
		}

		advance_ticks(frame_ticks);
		const a2 = w.get(id, anim_c);
		expect(a2.ok && a2.value.frame).toBe(2);
		const sd2 = w.get(id, sprite_c);
		if (sd2.ok && sd2.value.node) {
			expect(sd2.value.node.texture).toBe(sheet.textures["f2.png"] as Texture);
		}
	});

	test("missing-frame fallback uses __default__ atlas", () => {
		const w = world();
		const sch = schedule();
		const t = time();
		const r = rng(1);
		const res = resources();

		const a = assets({ fixed_dt: t.fixed_dt, register_default: true });
		res.set(atlas_registry, a.registry() as AtlasRegistry);

		const ctx: Ctx = {
			time: t,
			rng: r,
			res,
			input: input(),
			debug: debug_noop(),
			palette: palette_noop(),
		};

		const an = anim();
		sch.add("update", an.advance, "anim.advance");
		sch.add("post", anim_sync_system({ assets: a }), "anim.sync");

		const id = w.spawn(
			[pos, { x: 0, y: 0 }],
			[anim_c, { atlas: "missing", sequence: "spin", frame: 0, t: 0, speed: 1, loop: true, done: false }],
			[sprite_c, { texture: "__default__", node: { texture: null } as never }],
		);

		for (let i = 0; i < 5; i++) sch.run("update", w, ctx);
		sch.run("post", w, ctx);

		const sd = w.get(id, sprite_c);
		expect(sd.ok).toBe(true);
		if (sd.ok && sd.value.node) {
			expect(sd.value.node.texture).toBeDefined();
			expect(sd.value.node.texture).not.toBeNull();
		}
	});

	test("__default__ atlas is auto-registered with a 4-frame spin sequence", () => {
		const t = time();
		const a = assets({ fixed_dt: t.fixed_dt, register_default: true });
		const reg = a.registry();
		expect(reg["__default__"]).toBeDefined();
		expect(reg["__default__"]!["spin"]).toBeDefined();
		expect(reg["__default__"]!["spin"]!.length).toBe(4);
	});
});
