import { describe, expect, test } from "bun:test";
import { component, world } from "../../src/index.ts";
import { grid, move_tile } from "../../src/grid/index.ts";
import type { Cell } from "../../src/grid/index.ts";

const pos_c = component<{ x: number; y: number }>("test.pos");

const setup = () => {
	const w = world();
	const g = grid({ cols: 10, rows: 10, tile: 16 });
	const start = g.cell_to_world(5, 5);
	const id = w.spawn([pos_c, { x: start.x, y: start.y }]);
	return { w, g, id };
};

describe("move_tile", () => {
	test("moves into an empty cell and updates pos", () => {
		const { w, g, id } = setup();
		const r = move_tile(w, id, pos_c, g, { dx: 1, dy: 0 }, { blocked_by: () => false });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.value.moved).toBe(true);
		expect(r.value.from).toEqual({ x: 5, y: 5 });
		expect(r.value.to).toEqual({ x: 6, y: 5 });

		const got = w.get(id, pos_c);
		expect(got.ok).toBe(true);
		if (!got.ok) return;
		const expected = g.cell_to_world(6, 5);
		expect(got.value).toEqual(expected);
	});

	test("blocked target leaves pos unchanged and reports moved=false", () => {
		const { w, g, id } = setup();
		const blocked: Cell = { x: 6, y: 5 };
		const r = move_tile(w, id, pos_c, g, { dx: 1, dy: 0 }, {
			blocked_by: c => c.x === blocked.x && c.y === blocked.y,
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.value.moved).toBe(false);
		expect(r.value.to).toEqual({ x: 5, y: 5 });
	});

	test("zero direction is a no-op", () => {
		const { w, g, id } = setup();
		const r = move_tile(w, id, pos_c, g, { dx: 0, dy: 0 }, { blocked_by: () => false });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.value.moved).toBe(false);
	});

	test("slide=true: blocked X leaves Y attempt to succeed", () => {
		const { w, g, id } = setup();
		const r = move_tile(w, id, pos_c, g, { dx: 1, dy: 1 }, {
			blocked_by: c => c.x === 6 && c.y === 5,
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.value.to).toEqual({ x: 5, y: 6 });
		expect(r.value.moved).toBe(true);
	});

	test("slide=false: any blocked component aborts diagonal", () => {
		const { w, g, id } = setup();
		const r = move_tile(w, id, pos_c, g, { dx: 1, dy: 1 }, {
			slide: false,
			blocked_by: c => c.x === 6 && c.y === 6,
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.value.moved).toBe(false);
	});

	test("slide prevents corner-cutting when both axes blocked", () => {
		const { w, g, id } = setup();
		const r = move_tile(w, id, pos_c, g, { dx: 1, dy: 1 }, {
			blocked_by: c => (c.x === 6 && c.y === 5) || (c.x === 5 && c.y === 6) || (c.x === 6 && c.y === 6),
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.value.moved).toBe(false);
	});

	test("respects in_bounds — cannot step out of the board", () => {
		const w = world();
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const corner = g.cell_to_world(0, 0);
		const id = w.spawn([pos_c, { x: corner.x, y: corner.y }]);
		const r = move_tile(w, id, pos_c, g, { dx: -1, dy: 0 }, { blocked_by: () => false });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.value.moved).toBe(false);
	});

	test("missing pos component returns an error", () => {
		const w = world();
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const id = w.spawn();
		const r = move_tile(w, id, pos_c, g, { dx: 1, dy: 0 }, { blocked_by: () => false });
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.error.kind).toBe("component_missing");
	});
});
