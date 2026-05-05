import { describe, expect, test } from "bun:test";
import { harness, component } from "../src/index.ts";
import { presets } from "../src/presets/index.ts";

describe("harness", () => {
	test("returns all 8 fields plus ctx and tick", () => {
		const h = harness();
		expect(h.world).toBeDefined();
		expect(h.schedule).toBeDefined();
		expect(h.time).toBeDefined();
		expect(h.rng).toBeDefined();
		expect(h.res).toBeDefined();
		expect(h.input).toBeDefined();
		expect(h.debug).toBeDefined();
		expect(h.palette).toBeDefined();
		expect(h.ctx).toBeDefined();
		expect(typeof h.tick).toBe("function");
	});

	test("ctx contains the same instances exposed at the top level", () => {
		const h = harness();
		expect(h.ctx.time).toBe(h.time);
		expect(h.ctx.rng).toBe(h.rng);
		expect(h.ctx.res).toBe(h.res);
		expect(h.ctx.input).toBe(h.input);
		expect(h.ctx.debug).toBe(h.debug);
		expect(h.ctx.palette).toBe(h.palette);
	});

	test("opts default correctly", () => {
		const h = harness();
		expect(h.time.fixed_dt).toBeCloseTo(1 / 60);
		expect(h.rng.seed).toBe(0);
		expect(h.input.bindings()).toEqual({ digital: {}, axes: {}, deadzone: 0.15 });
	});

	test("custom opts apply", () => {
		const h = harness({ seed: 42, fixed_dt: 1 / 30, bindings: presets.movement2d });
		expect(h.time.fixed_dt).toBeCloseTo(1 / 30);
		expect(h.rng.seed).toBe(42);
		expect(h.input.bindings().axes["move.x"]).toBeDefined();
	});

	test("tick advances time deterministically", () => {
		const h = harness();
		expect(h.time.tick).toBe(0);
		h.tick();
		expect(h.time.tick).toBe(1);
		for (let i = 0; i < 60; i++) h.tick();
		expect(h.time.tick).toBe(61);
	});

	test("tick runs update systems in schedule order", () => {
		const h = harness();
		const calls: string[] = [];
		h.schedule.add("update", () => calls.push("a"), "a");
		h.schedule.add("update", () => calls.push("b"), "b");
		h.tick();
		expect(calls).toEqual(["a", "b"]);
	});

	test("two harnesses with same seed produce same RNG output", () => {
		const a = harness({ seed: 7 });
		const b = harness({ seed: 7 });
		const aa = [a.rng.next(), a.rng.next(), a.rng.next()];
		const bb = [b.rng.next(), b.rng.next(), b.rng.next()];
		expect(aa).toEqual(bb);
	});

	test("__dev__: false swaps debug to no-op", () => {
		const dev = harness({ __dev__: true });
		const prod = harness({ __dev__: false });
		const c = component<{ x: number }>("c");
		const id = dev.world.spawn([c, { x: 1 }]);
		dev.debug.line({ x: 0, y: 0 }, { x: 1, y: 1 });
		expect(dev.debug.frame().length).toBe(1);
		prod.world.spawn_at(id, [c, { x: 1 }]);
		prod.debug.line({ x: 0, y: 0 }, { x: 1, y: 1 });
		expect(prod.debug.frame().length).toBe(0);
	});
});
