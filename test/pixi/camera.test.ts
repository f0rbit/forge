import { describe, expect, test } from "bun:test";
import { camera } from "../../src/pixi/index.ts";

describe("camera fit math", () => {
	test("fit mode letterboxes when window aspect is wider", () => {
		const c = camera({ mode: "fit", width: 320, height: 240 });
		c.resize(640, 240);
		const s = c.state();
		expect(s.scale).toBe(1);
		expect(s.offset_x).toBe(160);
		expect(s.offset_y).toBe(0);
	});

	test("fit mode pillarboxes when window aspect is narrower", () => {
		const c = camera({ mode: "fit", width: 320, height: 240 });
		c.resize(320, 480);
		const s = c.state();
		expect(s.scale).toBe(1);
		expect(s.offset_x).toBe(0);
		expect(s.offset_y).toBe(120);
	});

	test("fill mode covers, may crop", () => {
		const c = camera({ mode: "fill", width: 100, height: 100 });
		c.resize(200, 100);
		expect(c.state().scale).toBe(2);
	});

	test("fixed mode is identity", () => {
		const c = camera({ mode: "fixed", width: 100, height: 100 });
		c.resize(500, 500);
		const s = c.state();
		expect(s.scale).toBe(1);
		expect(s.offset_x).toBe(0);
		expect(s.offset_y).toBe(0);
	});
});

describe("world_to_screen / screen_to_world", () => {
	test("are inverses of each other (fit, equal aspect)", () => {
		const c = camera({ mode: "fit", width: 100, height: 100 });
		c.resize(100, 100);
		const w = { x: 25, y: 75 };
		const s = c.world_to_screen(w);
		const back = c.screen_to_world(s);
		expect(back.x).toBeCloseTo(w.x, 5);
		expect(back.y).toBeCloseTo(w.y, 5);
	});

	test("are inverses with letterboxing", () => {
		const c = camera({ mode: "fit", width: 320, height: 240 });
		c.resize(640, 240);
		const w = { x: 50, y: 100 };
		const s = c.world_to_screen(w);
		const back = c.screen_to_world(s);
		expect(back.x).toBeCloseTo(w.x, 5);
		expect(back.y).toBeCloseTo(w.y, 5);
	});

	test("respect zoom", () => {
		const c = camera({ mode: "fixed", width: 100, height: 100 });
		c.zoom = 2;
		const screen = c.world_to_screen({ x: 10, y: 10 });
		expect(screen.x).toBe(20);
		expect(screen.y).toBe(20);
	});
});
