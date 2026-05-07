import { describe, expect, test } from "bun:test";
import { world, component, internal } from "../src/index.ts";

describe("world", () => {
	const pos = component<{ x: number; y: number }>("pos");
	const vel = component<{ dx: number; dy: number }>("vel");
	const tag = component<true>("tag");

	test("spawn returns monotonically incrementing ids", () => {
		const w = world();
		const a = w.spawn();
		const b = w.spawn();
		const c = w.spawn();
		expect(a).toBe(1 as typeof a);
		expect(b).toBe(2 as typeof b);
		expect(c).toBe(3 as typeof c);
		expect(w.count()).toBe(3);
	});

	test("spawn with components stores typed data", () => {
		const w = world();
		const id = w.spawn([pos, { x: 10, y: 20 }], [vel, { dx: 1, dy: 0 }]);
		expect(w.has(id, pos)).toBe(true);
		expect(w.has(id, vel)).toBe(true);
		expect(w.has(id, tag)).toBe(false);

		const got = w.get(id, pos);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toEqual({ x: 10, y: 20 });
	});

	test("get on entity without component returns component_missing error", () => {
		const w = world();
		const id = w.spawn([pos, { x: 0, y: 0 }]);
		const r = w.get(id, vel);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.kind).toBe("component_missing");
			if (r.error.kind === "component_missing") expect(r.error.component).toBe("vel");
		}
	});

	test("set updates an existing component and adds new ones", () => {
		const w = world();
		const id = w.spawn([pos, { x: 0, y: 0 }]);
		expect(w.set(id, pos, { x: 5, y: 5 }).ok).toBe(true);
		expect(w.set(id, vel, { dx: 1, dy: 1 }).ok).toBe(true);

		const p = w.get(id, pos);
		expect(p.ok && p.value.x).toBe(5);
		const v = w.get(id, vel);
		expect(v.ok && v.value.dx).toBe(1);
	});

	test("set on missing entity returns entity_not_found", () => {
		const w = world();
		const r = w.set(999 as ReturnType<typeof w.spawn>, pos, { x: 0, y: 0 });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("entity_not_found");
	});

	test("despawn removes entity from all stores", () => {
		const w = world();
		const id = w.spawn([pos, { x: 0, y: 0 }], [vel, { dx: 0, dy: 0 }]);
		expect(w.despawn(id).ok).toBe(true);
		expect(w.has(id, pos)).toBe(false);
		expect(w.has(id, vel)).toBe(false);
		expect(w.count()).toBe(0);
	});

	test("despawn on missing entity returns entity_not_found", () => {
		const w = world();
		const r = w.despawn(42 as ReturnType<typeof w.spawn>);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("entity_not_found");
	});

	test("remove deletes a single component without despawning", () => {
		const w = world();
		const id = w.spawn([pos, { x: 0, y: 0 }], [vel, { dx: 1, dy: 0 }]);
		expect(w.remove(id, vel).ok).toBe(true);
		expect(w.has(id, pos)).toBe(true);
		expect(w.has(id, vel)).toBe(false);
		expect(w.count()).toBe(1);
	});

	test("internal.components_of returns the component objects on the entity", () => {
		const w = world();
		const id = w.spawn([pos, { x: 0, y: 0 }], [vel, { dx: 0, dy: 0 }]);
		const cs = w[internal].components_of(id);
		const names = cs.map(c => c.name).sort();
		expect(names).toEqual(["pos", "vel"]);
	});

	test("clear despawns every entity, clears stores, resets id counter, world stays functional", () => {
		const w = world();
		w.spawn([pos, { x: 1, y: 1 }], [vel, { dx: 1, dy: 0 }]);
		w.spawn([pos, { x: 2, y: 2 }], [tag, true]);
		w.spawn([pos, { x: 3, y: 3 }]);
		expect(w.count()).toBe(3);

		w.clear();

		expect(w.count()).toBe(0);
		expect(w.query([pos]).collect().length).toBe(0);
		expect(w.query([vel]).collect().length).toBe(0);
		expect(w.query([tag]).collect().length).toBe(0);

		const stores = w[internal].stores();
		for (const [, store] of stores) expect(store.size).toBe(0);

		const fresh = w.spawn([pos, { x: 9, y: 9 }]);
		expect(fresh).toBe(1 as typeof fresh);
		const got = w.get(fresh, pos);
		expect(got.ok && got.value).toEqual({ x: 9, y: 9 });
		expect(w.despawn(fresh).ok).toBe(true);
		expect(w.count()).toBe(0);
	});

	test("internal symbol resolves via global registry — Symbol.for parity", () => {
		expect(internal as symbol).toBe(Symbol.for("forge.world.internal"));
		expect(Symbol.keyFor(internal as symbol)).toBe("forge.world.internal");
	});

	describe("spawn_many", () => {
		test("spawns N entities each with the factory's component set", () => {
			const w = world();
			const ids = w.spawn_many(4, i => [
				[pos, { x: i, y: i * 2 }],
				[vel, { dx: i + 1, dy: 0 }],
			] as const);
			expect(ids).toHaveLength(4);
			expect(w.count()).toBe(4);
			for (let i = 0; i < ids.length; i++) {
				const id = ids[i]!;
				const p = w.get(id, pos);
				const v = w.get(id, vel);
				expect(p.ok && p.value).toEqual({ x: i, y: i * 2 });
				expect(v.ok && v.value).toEqual({ dx: i + 1, dy: 0 });
			}
		});

		test("returns Id[] in monotonically increasing order matching spawn order", () => {
			const w = world();
			const ids = w.spawn_many(3, () => [[pos, { x: 0, y: 0 }]] as const);
			expect(ids[0]).toBeLessThan(ids[1]!);
			expect(ids[1]).toBeLessThan(ids[2]!);
		});

		test("factory's i parameter increments correctly", () => {
			const w = world();
			const seen: number[] = [];
			w.spawn_many(5, i => {
				seen.push(i);
				return [[pos, { x: i, y: 0 }]] as const;
			});
			expect(seen).toEqual([0, 1, 2, 3, 4]);
		});

		test("count: 0 returns an empty array and spawns nothing", () => {
			const w = world();
			const ids = w.spawn_many(0, () => [[pos, { x: 0, y: 0 }]] as const);
			expect(ids).toEqual([]);
			expect(w.count()).toBe(0);
		});

		test("negative count throws", () => {
			const w = world();
			expect(() => w.spawn_many(-1, () => [[pos, { x: 0, y: 0 }]] as const)).toThrow(/non-negative integer/);
		});

		test("non-integer count throws", () => {
			const w = world();
			expect(() => w.spawn_many(2.5, () => [[pos, { x: 0, y: 0 }]] as const)).toThrow(/non-negative integer/);
		});
	});

	describe("despawn_marked", () => {
		const floor_c = component<true>("floor");
		const player_c = component<true>("player");
		const enemy_c = component<true>("enemy");

		test("despawns entities matching the single marker, leaves others", () => {
			const w = world();
			w.spawn([pos, { x: 0, y: 0 }], [floor_c, true]);
			w.spawn([pos, { x: 1, y: 1 }], [floor_c, true]);
			w.spawn([pos, { x: 2, y: 2 }], [floor_c, true]);
			w.spawn([pos, { x: 9, y: 9 }], [player_c, true]);

			const n = w.despawn_marked(floor_c);
			expect(n).toBe(3);
			expect(w.count()).toBe(1);
			expect(w.query([floor_c]).collect().length).toBe(0);
			expect(w.query([player_c]).collect().length).toBe(1);
		});

		test("returns count despawned including zero when no entity matches", () => {
			const w = world();
			w.spawn([pos, { x: 0, y: 0 }], [player_c, true]);
			expect(w.despawn_marked(enemy_c)).toBe(0);
			expect(w.count()).toBe(1);
		});

		test("AND-combines multiple markers — entity must have all listed", () => {
			const w = world();
			w.spawn([floor_c, true]);
			w.spawn([floor_c, true], [enemy_c, true]);
			w.spawn([enemy_c, true]);
			w.spawn([player_c, true], [enemy_c, true]);

			const n = w.despawn_marked(floor_c, enemy_c);
			expect(n).toBe(1);
			expect(w.count()).toBe(3);
			expect(w.query([floor_c]).collect().length).toBe(1);
			expect(w.query([enemy_c]).collect().length).toBe(2);
		});

		test("empty markers list is a no-op returning 0", () => {
			const w = world();
			w.spawn([pos, { x: 0, y: 0 }]);
			w.spawn([pos, { x: 1, y: 1 }]);
			expect(w.despawn_marked()).toBe(0);
			expect(w.count()).toBe(2);
		});

		test("clears all stores for despawned entities (not just markers)", () => {
			const w = world();
			const id = w.spawn([pos, { x: 5, y: 5 }], [vel, { dx: 1, dy: 0 }], [enemy_c, true]);
			w.spawn([pos, { x: 0, y: 0 }], [player_c, true]);

			expect(w.despawn_marked(enemy_c)).toBe(1);
			expect(w.has(id, pos)).toBe(false);
			expect(w.has(id, vel)).toBe(false);
			expect(w.has(id, enemy_c)).toBe(false);
		});
	});
});
