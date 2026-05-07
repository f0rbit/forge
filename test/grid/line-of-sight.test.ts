import { describe, expect, test } from "bun:test";
import { grid } from "../../src/grid/index.ts";

const make_floors = (cols: number, rows: number): Set<number> => {
	const floors = new Set<number>();
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) floors.add(y * cols + x);
	}
	return floors;
};

describe("grid.line_of_sight", () => {
	test("origin always visible by default", () => {
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const visible = g.line_of_sight({
			from: { x: 5, y: 5 },
			radius: 3,
			is_blocking: () => false,
		});
		expect(visible.has(g.key(5, 5))).toBe(true);
	});

	test("include_origin=false drops the origin cell", () => {
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const visible = g.line_of_sight({
			from: { x: 5, y: 5 },
			radius: 3,
			is_blocking: () => false,
			include_origin: false,
		});
		expect(visible.has(g.key(5, 5))).toBe(false);
	});

	test("open room sees every cell within Chebyshev radius", () => {
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const visible = g.line_of_sight({
			from: { x: 5, y: 5 },
			radius: 2,
			is_blocking: () => false,
		});
		for (let dy = -2; dy <= 2; dy++) {
			for (let dx = -2; dx <= 2; dx++) {
				expect(visible.has(g.key(5 + dx, 5 + dy))).toBe(true);
			}
		}
	});

	test("respects Chebyshev radius — cells beyond radius excluded", () => {
		const g = grid({ cols: 20, rows: 20, tile: 16 });
		const visible = g.line_of_sight({
			from: { x: 10, y: 10 },
			radius: 3,
			is_blocking: () => false,
		});
		expect(visible.has(g.key(13, 10))).toBe(true);
		expect(visible.has(g.key(14, 10))).toBe(false);
	});

	test("a wall blocks cells past it on the same line", () => {
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const wall_x = 7;
		const visible = g.line_of_sight({
			from: { x: 5, y: 5 },
			radius: 5,
			is_blocking: c => c.x === wall_x && c.y === 5,
		});
		expect(visible.has(g.key(6, 5))).toBe(true);
		expect(visible.has(g.key(8, 5))).toBe(false);
		expect(visible.has(g.key(9, 5))).toBe(false);
	});

	test("symmetric on cardinal/diagonal axes (Bresenham symmetric there)", () => {
		const g = grid({ cols: 12, rows: 12, tile: 16 });
		const walls = new Set<number>([g.key(6, 4), g.key(4, 7), g.key(8, 8)]);
		const is_blocking = (c: { x: number; y: number }) => walls.has(g.key(c.x, c.y));
		const a = { x: 5, y: 5 };
		const va = g.line_of_sight({ from: a, radius: 5, is_blocking });
		for (const k of va) {
			const cell = g.unkey(k);
			if (walls.has(k)) continue;
			const dx = cell.x - a.x;
			const dy = cell.y - a.y;
			if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) continue;
			const vb = g.line_of_sight({ from: cell, radius: 5, is_blocking });
			expect(vb.has(g.key(a.x, a.y))).toBe(true);
		}
	});

	test("from outside the grid returns an empty set", () => {
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const visible = g.line_of_sight({
			from: { x: -1, y: -1 },
			radius: 3,
			is_blocking: () => false,
		});
		expect(visible.size).toBe(0);
	});

	test("matches dungeon-walk's visible_keys semantics for an open 5x5 room", () => {
		const g = grid({ cols: 5, rows: 5, tile: 16 });
		const floors = make_floors(g.cols, g.rows);
		const visible = g.line_of_sight({
			from: { x: 2, y: 2 },
			radius: 6,
			is_blocking: c => !floors.has(g.key(c.x, c.y)),
		});
		expect(visible.size).toBe(25);
	});
});
