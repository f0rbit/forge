import { describe, expect, test } from "bun:test";
import { grid } from "../../src/grid/index.ts";
import type { Cell } from "../../src/grid/index.ts";

const g = grid({ cols: 64, rows: 64, tile: 1 });
const collect = (a: Cell, b: Cell): Cell[] => Array.from(g.line(a, b));

describe("grid.line", () => {
	test("single-cell line yields just the endpoint", () => {
		const cells = collect({ x: 4, y: 4 }, { x: 4, y: 4 });
		expect(cells).toEqual([{ x: 4, y: 4 }]);
	});

	test("includes both endpoints in horizontal walk", () => {
		const cells = collect({ x: 0, y: 0 }, { x: 3, y: 0 });
		expect(cells).toEqual([
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
			{ x: 2, y: 0 },
			{ x: 3, y: 0 },
		]);
	});

	test("includes both endpoints in vertical walk", () => {
		const cells = collect({ x: 2, y: 1 }, { x: 2, y: 4 });
		expect(cells).toEqual([
			{ x: 2, y: 1 },
			{ x: 2, y: 2 },
			{ x: 2, y: 3 },
			{ x: 2, y: 4 },
		]);
	});

	test("length matches max(|dx|,|dy|) + 1", () => {
		expect(collect({ x: 0, y: 0 }, { x: 5, y: 0 })).toHaveLength(6);
		expect(collect({ x: 0, y: 0 }, { x: 5, y: 3 })).toHaveLength(6);
		expect(collect({ x: 0, y: 0 }, { x: 3, y: 5 })).toHaveLength(6);
		expect(collect({ x: 1, y: 1 }, { x: -2, y: -3 })).toHaveLength(5);
	});

	test("reverse(line(a,b)) equals line(b,a)", () => {
		const a: Cell = { x: 0, y: 0 };
		const b: Cell = { x: 7, y: 4 };
		const ab = collect(a, b);
		const ba = collect(b, a);
		const rev = [...ab].reverse();
		expect(rev).toEqual(ba);
	});

	test("diagonal line steps one each axis per cell", () => {
		const cells = collect({ x: 0, y: 0 }, { x: 4, y: 4 });
		expect(cells).toEqual([
			{ x: 0, y: 0 },
			{ x: 1, y: 1 },
			{ x: 2, y: 2 },
			{ x: 3, y: 3 },
			{ x: 4, y: 4 },
		]);
	});

	test("first yielded cell is always a", () => {
		const a: Cell = { x: 9, y: 3 };
		const b: Cell = { x: -2, y: 8 };
		const cells = collect(a, b);
		expect(cells[0]).toEqual(a);
		expect(cells[cells.length - 1]).toEqual(b);
	});
});
