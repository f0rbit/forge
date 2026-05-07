import { describe, expect, test } from "bun:test";
import { component, world } from "../../src/index.ts";
import { grid, grid_index, grid_index_sync_system } from "../../src/grid/index.ts";

const pos_c = component<{ x: number; y: number }>("test.pos");
const enemy_c = component<true>("test.enemy");
const item_c = component<true>("test.item");

describe("grid_index", () => {
	test("at returns the entity placed at a cell", () => {
		const w = world();
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const p = g.cell_to_world(3, 4);
		const id = w.spawn([pos_c, { x: p.x, y: p.y }]);
		const idx = grid_index(w, pos_c, g);
		expect(idx.at({ x: 3, y: 4 })).toBe(id);
		expect(idx.at({ x: 0, y: 0 })).toBe(null);
	});

	test("all_at returns every entity at a cell", () => {
		const w = world();
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const p = g.cell_to_world(2, 2);
		const a = w.spawn([pos_c, { x: p.x, y: p.y }]);
		const b = w.spawn([pos_c, { x: p.x, y: p.y }]);
		const idx = grid_index(w, pos_c, g);
		const found = idx.all_at({ x: 2, y: 2 });
		expect(found).toHaveLength(2);
		expect(found).toContain(a);
		expect(found).toContain(b);
	});

	test("around honours the radius window", () => {
		const w = world();
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		for (let y = 0; y < 5; y++) {
			for (let x = 0; x < 5; x++) {
				const p = g.cell_to_world(x, y);
				w.spawn([pos_c, { x: p.x, y: p.y }]);
			}
		}
		const idx = grid_index(w, pos_c, g);
		expect(idx.around({ x: 2, y: 2 }, 1)).toHaveLength(9);
		expect(idx.around({ x: 2, y: 2 }, 2)).toHaveLength(25);
		expect(idx.around({ x: 0, y: 0 }, 1)).toHaveLength(4);
	});

	test("filter restricts the indexed set to entities with the marker", () => {
		const w = world();
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const ep = g.cell_to_world(1, 1);
		const ip = g.cell_to_world(2, 2);
		w.spawn([pos_c, { x: ep.x, y: ep.y }], [enemy_c, true]);
		const item = w.spawn([pos_c, { x: ip.x, y: ip.y }], [item_c, true]);
		const idx = grid_index(w, pos_c, g, item_c);
		expect(idx.at({ x: 1, y: 1 })).toBe(null);
		expect(idx.at({ x: 2, y: 2 })).toBe(item);
	});

	test("refresh picks up newly-spawned and despawned entities", () => {
		const w = world();
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const idx = grid_index(w, pos_c, g);
		expect(idx.at({ x: 4, y: 4 })).toBe(null);

		const p = g.cell_to_world(4, 4);
		const id = w.spawn([pos_c, { x: p.x, y: p.y }]);
		idx.refresh();
		expect(idx.at({ x: 4, y: 4 })).toBe(id);

		w.despawn(id);
		idx.refresh();
		expect(idx.at({ x: 4, y: 4 })).toBe(null);
	});

	test("entities outside grid bounds are skipped", () => {
		const w = world();
		const g = grid({ cols: 5, rows: 5, tile: 16 });
		const inside = g.cell_to_world(1, 1);
		w.spawn([pos_c, { x: inside.x, y: inside.y }]);
		w.spawn([pos_c, { x: -100, y: -100 }]);
		const idx = grid_index(w, pos_c, g);
		expect(idx.at({ x: 1, y: 1 })).not.toBe(null);
	});

	test("grid_index_sync_system refreshes on tick", () => {
		const w = world();
		const g = grid({ cols: 10, rows: 10, tile: 16 });
		const idx = grid_index(w, pos_c, g);
		const sys = grid_index_sync_system(idx);

		const p = g.cell_to_world(7, 7);
		const id = w.spawn([pos_c, { x: p.x, y: p.y }]);
		expect(idx.at({ x: 7, y: 7 })).toBe(null);
		sys(w, {} as never);
		expect(idx.at({ x: 7, y: 7 })).toBe(id);
	});
});
