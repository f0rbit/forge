import { describe, expect, test } from "bun:test";
import { Container } from "pixi.js";
import { world, time, rng, resources, input, palette_noop, debug, type Ctx } from "../../src/index.ts";
import { vec2 } from "../../src/math.ts";
import { debug_pixi } from "../../src/pixi/index.ts";

const make_ctx = (dbg: ReturnType<typeof debug>): Ctx => ({
	time: time(),
	rng: rng(1),
	res: resources(),
	input: input(),
	debug: dbg,
	palette: palette_noop(),
});

describe("debug_pixi", () => {
	test("drains debug.frame() and renders into overlay container", () => {
		const w = world();
		const overlay = new Container();
		const dbg = debug({ enabled: true, dev: true });
		const sys = debug_pixi({ overlay, dev: true });
		const ctx = make_ctx(dbg);

		dbg.line(vec2(0, 0), vec2(10, 10), "white");
		dbg.text(vec2(50, 60), "hello");
		sys(w, ctx);

		expect(overlay.visible).toBe(true);
		expect(overlay.children.length).toBeGreaterThan(0);
	});

	test("hides overlay when debug.enabled is false", () => {
		const w = world();
		const overlay = new Container();
		const dbg = debug({ enabled: false, dev: true });
		const sys = debug_pixi({ overlay, dev: true });
		const ctx = make_ctx(dbg);
		sys(w, ctx);
		expect(overlay.visible).toBe(false);
	});

	test("__DEV__=false installs as no-op (overlay untouched)", () => {
		const w = world();
		const overlay = new Container();
		const before = overlay.children.length;
		const dbg = debug({ enabled: true, dev: false });
		const sys = debug_pixi({ overlay, dev: false });
		const ctx = make_ctx(dbg);
		sys(w, ctx);
		expect(overlay.children.length).toBe(before);
	});

	test("renders pinned per-entity labels", () => {
		const w = world();
		const overlay = new Container();
		const dbg = debug({ enabled: true, dev: true });
		const sys = debug_pixi({ overlay, dev: true });
		const ctx = make_ctx(dbg);

		const id = w.spawn();
		dbg.pin(id, { kind: "label", data: "boss", ttl: 60 });
		sys(w, ctx);
		expect(overlay.children.length).toBeGreaterThan(0);
	});
});
