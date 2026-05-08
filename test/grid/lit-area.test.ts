import { describe, expect, test } from "bun:test";
import { grid } from "../../src/grid/index.ts";

describe("grid.lit_area", () => {
	test("origin is always intensity 1.0", () => {
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const lit = g.lit_area({
			from: { x: 5, y: 5 },
			radius: 4,
			is_blocking: () => false,
		});
		expect(lit.get(g.key(5, 5))).toBe(1);
	});

	test("default linear falloff: cells at radius edge have intensity 0", () => {
		const g = grid({ cols: 12, rows: 12, tile: 16 });
		const lit = g.lit_area({
			from: { x: 6, y: 6 },
			radius: 3,
			is_blocking: () => false,
		});
		expect(lit.get(g.key(9, 6))).toBe(0);
		expect(lit.get(g.key(6, 9))).toBe(0);
		expect(lit.get(g.key(9, 9))).toBe(0);
	});

	test("default linear falloff: midpoint cells at half-radius hit ~0.5", () => {
		const g = grid({ cols: 12, rows: 12, tile: 16 });
		const lit = g.lit_area({
			from: { x: 6, y: 6 },
			radius: 4,
			is_blocking: () => false,
		});
		expect(lit.get(g.key(8, 6))).toBeCloseTo(0.5, 5);
	});

	test("cells outside radius are not in the map", () => {
		const g = grid({ cols: 20, rows: 20, tile: 16 });
		const lit = g.lit_area({
			from: { x: 10, y: 10 },
			radius: 3,
			is_blocking: () => false,
		});
		expect(lit.has(g.key(14, 10))).toBe(false);
		expect(lit.has(g.key(10, 14))).toBe(false);
	});

	test("walls block — cells beyond walls not in the map", () => {
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const wall_x = 7;
		const lit = g.lit_area({
			from: { x: 5, y: 5 },
			radius: 5,
			is_blocking: c => c.x === wall_x && c.y === 5,
		});
		expect(lit.has(g.key(6, 5))).toBe(true);
		expect(lit.has(g.key(8, 5))).toBe(false);
		expect(lit.has(g.key(9, 5))).toBe(false);
	});

	test("custom falloff function applied (quadratic)", () => {
		const g = grid({ cols: 12, rows: 12, tile: 16 });
		const quadratic = (d: number, max: number) => 1 - (d / max) ** 2;
		const lit = g.lit_area({
			from: { x: 6, y: 6 },
			radius: 4,
			is_blocking: () => false,
			falloff: quadratic,
		});
		expect(lit.get(g.key(8, 6))).toBeCloseTo(1 - (2 / 4) ** 2, 5);
		expect(lit.get(g.key(7, 6))).toBeCloseTo(1 - (1 / 4) ** 2, 5);
	});

	test("custom falloff is clamped to [0, 1]", () => {
		const g = grid({ cols: 8, rows: 8, tile: 16 });
		const wild = () => 5;
		const lit = g.lit_area({
			from: { x: 4, y: 4 },
			radius: 2,
			is_blocking: () => false,
			falloff: wild,
		});
		for (const v of lit.values()) expect(v).toBeLessThanOrEqual(1);

		const negative = () => -3;
		const lit2 = g.lit_area({
			from: { x: 4, y: 4 },
			radius: 2,
			is_blocking: () => false,
			falloff: negative,
		});
		expect(lit2.get(g.key(4, 4))).toBe(1);
		for (const [k, v] of lit2) {
			if (k === g.key(4, 4)) continue;
			expect(v).toBe(0);
		}
	});

	test("determinism: same input produces identical map", () => {
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const walls = new Set<number>([g.key(6, 5), g.key(4, 7)]);
		const opts = {
			from: { x: 5, y: 5 },
			radius: 4,
			is_blocking: (c: { x: number; y: number }) => walls.has(g.key(c.x, c.y)),
		};
		const a = g.lit_area(opts);
		const b = g.lit_area(opts);
		expect(a.size).toBe(b.size);
		for (const [k, v] of a) expect(b.get(k)).toBe(v);
	});

	test("from outside the grid returns an empty map", () => {
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const lit = g.lit_area({
			from: { x: -1, y: -1 },
			radius: 3,
			is_blocking: () => false,
		});
		expect(lit.size).toBe(0);
	});

	test("lit cells (intensity > 0) match line_of_sight visible set when origin included", () => {
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const walls = new Set<number>([g.key(7, 5), g.key(5, 7)]);
		const is_blocking = (c: { x: number; y: number }) => walls.has(g.key(c.x, c.y));
		const lit = g.lit_area({ from: { x: 5, y: 5 }, radius: 5, is_blocking });
		const visible = g.line_of_sight({ from: { x: 5, y: 5 }, radius: 5, is_blocking });
		expect(lit.size).toBe(visible.size);
		for (const k of visible) expect(lit.has(k)).toBe(true);
	});
});
