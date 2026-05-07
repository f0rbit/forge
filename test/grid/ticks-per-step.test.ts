import { describe, expect, test } from "bun:test";
import { ticks_per_step } from "../../src/grid/index.ts";

describe("ticks_per_step", () => {
	test("6 cells/sec at 1/60 fixed_dt rounds to 10 ticks/step", () => {
		expect(ticks_per_step(6, 1 / 60)).toBe(10);
	});

	test("3 cells/sec at 1/60 rounds to 20 ticks/step", () => {
		expect(ticks_per_step(3, 1 / 60)).toBe(20);
	});

	test("60 cells/sec at 1/60 rounds to 1 tick/step", () => {
		expect(ticks_per_step(60, 1 / 60)).toBe(1);
	});

	test("very fast input clamps to a minimum of 1 tick/step", () => {
		expect(ticks_per_step(1000, 1 / 60)).toBe(1);
	});

	test("4 cells/sec at 1/30 fixed_dt rounds to 8 ticks/step", () => {
		expect(ticks_per_step(4, 1 / 30)).toBe(8);
	});
});
