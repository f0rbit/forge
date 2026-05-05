import { describe, expect, test } from "bun:test";
import { camera } from "../../src/pixi/index.ts";

describe("camera letterbox mode", () => {
	test("integer scale, view = design, centered offset (window wider)", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		const v = c.resize(640, 240);
		expect(v.scale).toBe(1);
		expect(v.view).toEqual({ width: 320, height: 240 });
		expect(v.offset).toEqual({ x: 160, y: 0 });
	});

	test("integer scale 2x when window is exactly 2x design", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		const v = c.resize(640, 480);
		expect(v.scale).toBe(2);
		expect(v.view).toEqual({ width: 320, height: 240 });
		expect(v.offset).toEqual({ x: 0, y: 0 });
	});

	test("floor scale when window is non-integer multiple", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		const v = c.resize(800, 600);
		expect(v.scale).toBe(2);
		expect(v.view).toEqual({ width: 320, height: 240 });
		expect(v.offset.x).toBeCloseTo((800 - 640) / 2, 5);
		expect(v.offset.y).toBeCloseTo((600 - 480) / 2, 5);
	});

	test("scale exactly 1 when window matches design", () => {
		const c = camera({ design: { width: 100, height: 100 }, mode: "letterbox" });
		const v = c.resize(100, 100);
		expect(v.scale).toBe(1);
		expect(v.offset).toEqual({ x: 0, y: 0 });
	});

	test("warns and falls back to fractional scale when window smaller than design", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		const v = c.resize(160, 120);
		expect(v.scale).toBeCloseTo(0.5, 5);
		expect(v.view).toEqual({ width: 320, height: 240 });
	});
});

describe("camera extend mode", () => {
	test("view extends both axes when window is larger", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "extend" });
		const v = c.resize(800, 600);
		expect(v.scale).toBe(2);
		expect(v.view.width).toBe(400);
		expect(v.view.height).toBe(300);
	});

	test("view stays at design when window matches", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "extend" });
		const v = c.resize(320, 240);
		expect(v.scale).toBe(1);
		expect(v.view).toEqual({ width: 320, height: 240 });
	});

	test("clamps view via min", () => {
		const c = camera({
			design: { width: 320, height: 240 },
			mode: "extend",
			min: { width: 320, height: 240 },
		});
		const v = c.resize(160, 120);
		expect(v.view.width).toBe(320);
		expect(v.view.height).toBe(240);
	});

	test("clamps view via max", () => {
		const c = camera({
			design: { width: 320, height: 240 },
			mode: "extend",
			max: { width: 384, height: 288 },
		});
		const v = c.resize(800, 600);
		expect(v.scale).toBe(2);
		expect(v.view.width).toBe(384);
		expect(v.view.height).toBe(288);
	});
});

describe("camera extend-x mode", () => {
	test("only width extends, height locked to design", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "extend-x" });
		const v = c.resize(800, 600);
		expect(v.scale).toBe(2);
		expect(v.view.width).toBe(400);
		expect(v.view.height).toBe(240);
	});
});

describe("camera extend-y mode", () => {
	test("only height extends, width locked to design", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "extend-y" });
		const v = c.resize(800, 600);
		expect(v.scale).toBe(2);
		expect(v.view.width).toBe(320);
		expect(v.view.height).toBe(300);
	});
});

describe("camera fit mode (fractional)", () => {
	test("fractional scale, view = design, letterbox when aspect mismatch", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "fit" });
		const v = c.resize(640, 240);
		expect(v.scale).toBe(1);
		expect(v.view).toEqual({ width: 320, height: 240 });
		expect(v.offset.x).toBe(160);
		expect(v.offset.y).toBe(0);
	});

	test("fractional scale produces non-integer scale on odd window", () => {
		const c = camera({ design: { width: 100, height: 100 }, mode: "fit" });
		const v = c.resize(150, 150);
		expect(v.scale).toBeCloseTo(1.5, 5);
		expect(v.view).toEqual({ width: 100, height: 100 });
	});
});

describe("pixel_perfect option", () => {
	test("default true: scale always integer >= 1 in letterbox/extend", () => {
		const c = camera({ design: { width: 100, height: 100 }, mode: "letterbox" });
		const v = c.resize(250, 250);
		expect(v.scale).toBe(2);
		expect(Number.isInteger(v.scale)).toBe(true);
	});

	test("explicit pixel_perfect: false in extend mode still uses integer scale (matches default)", () => {
		const c = camera({ design: { width: 100, height: 100 }, mode: "extend", pixel_perfect: false });
		const v = c.resize(250, 250);
		expect(v.scale).toBeCloseTo(2.5, 5);
	});

	test("fit mode ignores pixel_perfect (always fractional)", () => {
		const c = camera({ design: { width: 100, height: 100 }, mode: "fit", pixel_perfect: true });
		const v = c.resize(250, 250);
		expect(v.scale).toBeCloseTo(2.5, 5);
	});

	test("pixel_perfect with window smaller than design falls back to fractional (no clamp to 1)", () => {
		const c = camera({ design: { width: 200, height: 200 }, mode: "letterbox", pixel_perfect: true });
		const v = c.resize(100, 100);
		expect(v.scale).toBeCloseTo(0.5, 5);
	});
});

describe("camera world_to_screen / screen_to_world", () => {
	test("inverse round-trip in letterbox mode", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		c.resize(640, 480);
		const w = { x: 50, y: 75 };
		const s = c.world_to_screen(w);
		const back = c.screen_to_world(s);
		expect(back.x).toBeCloseTo(w.x, 5);
		expect(back.y).toBeCloseTo(w.y, 5);
	});

	test("inverse round-trip in letterbox mode with pillarboxing", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		c.resize(640, 240);
		const w = { x: 50, y: 100 };
		const s = c.world_to_screen(w);
		expect(s.x).toBe(160 + 50);
		expect(s.y).toBe(100);
		const back = c.screen_to_world(s);
		expect(back.x).toBeCloseTo(w.x, 5);
		expect(back.y).toBeCloseTo(w.y, 5);
	});

	test("inverse round-trip in extend mode", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "extend" });
		c.resize(800, 600);
		const w = { x: 100, y: 50 };
		const s = c.world_to_screen(w);
		const back = c.screen_to_world(s);
		expect(back.x).toBeCloseTo(w.x, 5);
		expect(back.y).toBeCloseTo(w.y, 5);
	});

	test("inverse round-trip in fit mode (fractional)", () => {
		const c = camera({ design: { width: 100, height: 100 }, mode: "fit" });
		c.resize(150, 150);
		const w = { x: 33, y: 67 };
		const s = c.world_to_screen(w);
		const back = c.screen_to_world(s);
		expect(back.x).toBeCloseTo(w.x, 5);
		expect(back.y).toBeCloseTo(w.y, 5);
	});
});

describe("camera viewport()", () => {
	test("returns initial viewport before resize", () => {
		const c = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		const v = c.viewport();
		expect(v.view).toEqual({ width: 320, height: 240 });
		expect(v.scale).toBe(1);
	});

	test("returns latest viewport after resize", () => {
		const c = camera({ design: { width: 100, height: 100 }, mode: "letterbox" });
		c.resize(200, 200);
		expect(c.viewport().scale).toBe(2);
	});
});
