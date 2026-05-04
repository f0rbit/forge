import { describe, expect, test } from "bun:test";
import { Spritesheet, Texture, BufferImageSource } from "pixi.js";
import { assets, compile_sequences, default_atlas_json, make_default_spritesheet } from "../../src/pixi/assets.ts";

const fake_sheet = (frames: Record<string, { frame: { x: number; y: number; w: number; h: number }; duration?: number }>, animations?: Record<string, string[]>): Spritesheet => {
	const data = {
		frames,
		animations,
		meta: { format: "RGBA8888", size: { w: 64, h: 64 }, scale: 1 },
	};
	const pixels = new Uint8Array(64 * 64 * 4);
	const source = new BufferImageSource({ resource: pixels, width: 64, height: 64, alphaMode: "premultiply-alpha-on-upload" });
	const tex = new Texture({ source });
	const sheet = new Spritesheet(tex as never, data as never);
	sheet.parseSync();
	return sheet;
};

describe("assets()", () => {
	test("auto-registers the __default__ atlas with 4-frame spin sequence", () => {
		const a = assets();
		expect(a.has("__default__")).toBe(true);
		const reg = a.registry();
		expect(reg["__default__"]!["spin"]!.length).toBe(4);
		const default_sheet = a.get<Spritesheet>("__default__");
		expect(default_sheet.ok).toBe(true);
	});

	test("register_default: false skips placeholder", () => {
		const a = assets({ register_default: false });
		expect(a.has("__default__")).toBe(false);
	});

	test("register_atlas validates and populates the registry", () => {
		const a = assets({ register_default: false });
		const sheet = fake_sheet(
			{ a: { frame: { x: 0, y: 0, w: 16, h: 16 }, duration: 100 }, b: { frame: { x: 16, y: 0, w: 16, h: 16 }, duration: 100 } },
			{ idle: ["a", "b"] },
		);
		const r = a.register_atlas("hero", sheet);
		expect(r.ok).toBe(true);
		expect(a.has("hero")).toBe(true);
		expect(a.registry()["hero"]!["idle"]!.length).toBe(2);
	});

	test("register_atlas rejects malformed JSON (no frames)", () => {
		const a = assets({ register_default: false });
		const broken = { data: { meta: { scale: 1 } } } as unknown as Spritesheet;
		const r = a.register_atlas("broken", broken);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("invalid_atlas");
	});

	test("texture() returns not_loaded for missing alias", () => {
		const a = assets({ register_default: false });
		const r = a.texture("missing");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("not_loaded");
	});

	test("get<Spritesheet> returns the registered sheet", () => {
		const a = assets({ register_default: false });
		const sheet = fake_sheet({ a: { frame: { x: 0, y: 0, w: 16, h: 16 } } });
		a.register_atlas("hero", sheet);
		const r = a.get<Spritesheet>("hero");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value).toBe(sheet);
	});

	test("dispose clears cache and registry", () => {
		const a = assets({ register_default: true });
		expect(a.has("__default__")).toBe(true);
		a.dispose();
		expect(a.has("__default__")).toBe(false);
		expect(Object.keys(a.registry()).length).toBe(0);
	});
});

describe("compile_sequences()", () => {
	test("converts ms durations to whole ticks at 60Hz", () => {
		const json = {
			frames: {
				a: { frame: { x: 0, y: 0, w: 16, h: 16 }, duration: 100 },
				b: { frame: { x: 16, y: 0, w: 16, h: 16 }, duration: 200 },
			},
			animations: { run: ["a", "b"] },
			meta: { scale: 1 },
		};
		const seqs = compile_sequences(json as never, 1 / 60);
		expect(seqs["run"]!.length).toBe(2);
		expect(seqs["run"]![0]!.ticks).toBe(6);
		expect(seqs["run"]![1]!.ticks).toBe(12);
	});

	test("missing duration falls back to default tick count", () => {
		const json = { frames: { a: { frame: { x: 0, y: 0, w: 16, h: 16 } } }, animations: { idle: ["a"] }, meta: { scale: 1 } };
		const seqs = compile_sequences(json as never, 1 / 60);
		expect(seqs["idle"]![0]!.ticks).toBeGreaterThan(0);
	});

	test("falls back to __all__ sequence when no animations declared", () => {
		const json = { frames: { a: { frame: { x: 0, y: 0, w: 16, h: 16 } } }, meta: { scale: 1 } };
		const seqs = compile_sequences(json as never, 1 / 60);
		expect(seqs["__all__"]).toBeDefined();
	});
});

describe("default placeholder atlas", () => {
	test("default_atlas_json has 4 frames named __default_0..3__ and a spin sequence", () => {
		const j = default_atlas_json();
		expect(Object.keys(j.frames).length).toBe(4);
		expect(j.animations?.["spin"]).toEqual(["__default_0__", "__default_1__", "__default_2__", "__default_3__"]);
	});

	test("make_default_spritesheet returns a parsed Spritesheet with the four frame textures", () => {
		const r = make_default_spritesheet();
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.value.textures["__default_0__"]).toBeDefined();
			expect(r.value.textures["__default_3__"]).toBeDefined();
		}
	});
});
