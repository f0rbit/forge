import { describe, expect, test } from "bun:test";
import { time } from "../src/index.ts";

describe("time", () => {
	test("default fixed_dt is 1/60", () => {
		const t = time();
		expect(t.fixed_dt).toBeCloseTo(1 / 60, 10);
	});

	test("advance consumes whole fixed steps and increments tick + elapsed", () => {
		const t = time();
		const consumed = t.advance(1 / 60);
		expect(consumed).toBe(1);
		expect(t.tick).toBe(1);
		expect(t.elapsed).toBeCloseTo(1 / 60, 10);
	});

	test("accumulates leftover real_dt into alpha", () => {
		const t = time({ fixed_dt: 1 / 60 });
		t.advance(1 / 120);
		expect(t.tick).toBe(0);
		expect(t.alpha).toBeCloseTo(0.5, 5);
	});

	test("multiple steps in a single advance", () => {
		const t = time({ fixed_dt: 0.5 });
		const consumed = t.advance(2);
		expect(consumed).toBe(4);
		expect(t.tick).toBe(4);
		expect(t.elapsed).toBeCloseTo(2, 10);
	});

	test("scale multiplies real_dt", () => {
		const t = time({ fixed_dt: 1 / 60 });
		t.scale = 2;
		const consumed = t.advance(1 / 60);
		expect(consumed).toBe(2);
		expect(t.tick).toBe(2);
	});
});
