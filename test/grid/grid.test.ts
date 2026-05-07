import { describe, expect, test } from "bun:test";
import { grid } from "../../src/grid/index.ts";

describe("grid", () => {
	test("exposes opts as readonly fields", () => {
		const g = grid({ cols: 20, rows: 11, tile: 16 });
		expect(g.cols).toBe(20);
		expect(g.rows).toBe(11);
		expect(g.tile).toBe(16);
	});

	test("key/unkey round-trip across the board", () => {
		const g = grid({ cols: 20, rows: 11, tile: 16 });
		for (let y = 0; y < g.rows; y++) {
			for (let x = 0; x < g.cols; x++) {
				const k = g.key(x, y);
				const c = g.unkey(k);
				expect(c).toEqual({ x, y });
			}
		}
	});

	test("cell_to_world centres on the tile", () => {
		const g = grid({ cols: 20, rows: 11, tile: 16 });
		expect(g.cell_to_world(0, 0)).toEqual({ x: 8, y: 8 });
		expect(g.cell_to_world(2, 3)).toEqual({ x: 2 * 16 + 8, y: 3 * 16 + 8 });
	});

	test("world_to_cell rounds down (floor)", () => {
		const g = grid({ cols: 20, rows: 11, tile: 16 });
		expect(g.world_to_cell(0, 0)).toEqual({ x: 0, y: 0 });
		expect(g.world_to_cell(15.9, 15.9)).toEqual({ x: 0, y: 0 });
		expect(g.world_to_cell(16, 16)).toEqual({ x: 1, y: 1 });
		expect(g.world_to_cell(33, 49)).toEqual({ x: 2, y: 3 });
	});

	test("cell_to_world / world_to_cell round-trip preserves the cell", () => {
		const g = grid({ cols: 20, rows: 11, tile: 16 });
		for (let y = 0; y < g.rows; y++) {
			for (let x = 0; x < g.cols; x++) {
				const w = g.cell_to_world(x, y);
				const c = g.world_to_cell(w.x, w.y);
				expect(c).toEqual({ x, y });
			}
		}
	});

	test("in_bounds rejects coords outside the board", () => {
		const g = grid({ cols: 20, rows: 11, tile: 16 });
		expect(g.in_bounds(0, 0)).toBe(true);
		expect(g.in_bounds(19, 10)).toBe(true);
		expect(g.in_bounds(-1, 0)).toBe(false);
		expect(g.in_bounds(0, -1)).toBe(false);
		expect(g.in_bounds(20, 10)).toBe(false);
		expect(g.in_bounds(19, 11)).toBe(false);
	});

	test("chebyshev / manhattan compute the expected metrics", () => {
		const g = grid({ cols: 20, rows: 11, tile: 16 });
		expect(g.chebyshev({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4);
		expect(g.chebyshev({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
		expect(g.manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
		expect(g.manhattan({ x: -1, y: -1 }, { x: 1, y: 1 })).toBe(4);
	});

	test("neighbors4 returns four cardinal neighbours", () => {
		const g = grid({ cols: 20, rows: 11, tile: 16 });
		const n = g.neighbors4(5, 5);
		expect(n).toHaveLength(4);
		expect(n).toContainEqual({ x: 6, y: 5 });
		expect(n).toContainEqual({ x: 4, y: 5 });
		expect(n).toContainEqual({ x: 5, y: 6 });
		expect(n).toContainEqual({ x: 5, y: 4 });
	});

	test("neighbors8 returns eight neighbours", () => {
		const g = grid({ cols: 20, rows: 11, tile: 16 });
		const n = g.neighbors8(5, 5);
		expect(n).toHaveLength(8);
		const set = new Set(n.map(c => `${c.x},${c.y}`));
		expect(set.has("4,4")).toBe(true);
		expect(set.has("4,5")).toBe(true);
		expect(set.has("4,6")).toBe(true);
		expect(set.has("5,4")).toBe(true);
		expect(set.has("5,6")).toBe(true);
		expect(set.has("6,4")).toBe(true);
		expect(set.has("6,5")).toBe(true);
		expect(set.has("6,6")).toBe(true);
	});
});
