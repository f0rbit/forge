import { describe, expect, test } from "bun:test";
import { world, component } from "../src/index.ts";

describe("query", () => {
	const pos = component<{ x: number; y: number }>("pos");
	const vel = component<{ dx: number; dy: number }>("vel");
	const dead = component<true>("dead");

	test("yields entities that have all required components", () => {
		const w = world();
		const moving = w.spawn([pos, { x: 0, y: 0 }], [vel, { dx: 1, dy: 0 }]);
		w.spawn([pos, { x: 5, y: 5 }]);
		w.spawn([vel, { dx: 0, dy: 1 }]);

		const ids: number[] = [];
		w.query([pos, vel] as const).each(id => ids.push(id));
		expect(ids).toEqual([moving]);
	});

	test("collect returns tuple [id, ...data]", () => {
		const w = world();
		w.spawn([pos, { x: 1, y: 2 }], [vel, { dx: 3, dy: 4 }]);
		const all = w.query([pos, vel] as const).collect();
		expect(all).toHaveLength(1);
		const [, p, v] = all[0]!;
		expect(p).toEqual({ x: 1, y: 2 });
		expect(v).toEqual({ dx: 3, dy: 4 });
	});

	test("without filter excludes entities that have the named component", () => {
		const w = world();
		const alive = w.spawn([pos, { x: 0, y: 0 }], [vel, { dx: 1, dy: 0 }]);
		const corpse = w.spawn([pos, { x: 5, y: 5 }], [vel, { dx: 0, dy: 0 }], [dead, true]);

		const ids = w
			.query([pos, vel] as const, { without: [dead] })
			.collect()
			.map(([id]) => id);
		expect(ids).toContain(alive);
		expect(ids).not.toContain(corpse);
	});

	test("returns empty when no entities match", () => {
		const w = world();
		w.spawn([pos, { x: 0, y: 0 }]);
		expect(w.query([pos, vel] as const).collect()).toEqual([]);
	});

	test("returns empty when a required component has no store", () => {
		const w = world();
		w.spawn([pos, { x: 0, y: 0 }]);
		expect(w.query([pos, vel] as const).collect()).toEqual([]);
	});

	test("each is a generator and lazy — exiting iteration early is safe", () => {
		const w = world();
		for (let i = 0; i < 5; i++) w.spawn([pos, { x: i, y: 0 }]);
		let seen = 0;
		for (const _ of w.query([pos] as const)) {
			seen++;
			if (seen === 2) break;
		}
		expect(seen).toBe(2);
	});

	test("picks the smallest store as the primary iterator", () => {
		const w = world();
		for (let i = 0; i < 100; i++) w.spawn([pos, { x: 0, y: 0 }]);
		const target = w.spawn([pos, { x: 99, y: 99 }], [vel, { dx: 1, dy: 1 }]);
		const all = w.query([pos, vel] as const).collect();
		expect(all).toHaveLength(1);
		expect(all[0]![0]).toBe(target);
	});

	test("collect returns a snapshot independent of subsequent mutation", () => {
		const w = world();
		for (let i = 0; i < 5; i++) w.spawn([pos, { x: i, y: 0 }]);
		const snap = w.query([pos] as const).collect();
		expect(snap).toHaveLength(5);
		for (const [id] of snap) w.despawn(id);
		expect(w.count()).toBe(0);
		expect(snap).toHaveLength(5);
	});

	test("__DEV__ warns when world is mutated mid-iteration", () => {
		const w = world();
		for (let i = 0; i < 3; i++) w.spawn([pos, { x: i, y: 0 }]);
		const original = console.warn;
		const calls: string[] = [];
		console.warn = (...args: unknown[]) => {
			calls.push(args.map(String).join(" "));
		};
		try {
			let n = 0;
			for (const [id] of w.query([pos] as const)) {
				w.despawn(id);
				if (++n >= 2) break;
			}
		} finally {
			console.warn = original;
		}
		expect(calls.length).toBeGreaterThan(0);
		expect(calls[0]).toContain("collect()");
	});

	test("collect() does not trigger the mutation warning even when followed by mutation", () => {
		const w = world();
		for (let i = 0; i < 3; i++) w.spawn([pos, { x: i, y: 0 }]);
		const original = console.warn;
		const calls: string[] = [];
		console.warn = (...args: unknown[]) => {
			calls.push(args.map(String).join(" "));
		};
		try {
			for (const [id] of w.query([pos] as const).collect()) {
				w.despawn(id);
			}
		} finally {
			console.warn = original;
		}
		expect(calls.length).toBe(0);
	});

	describe("query_data", () => {
		const player = component<true>("player");
		const enemy = component<true>("enemy");

		test("yields entities matching all data + all marker components", () => {
			const w = world();
			const p = w.spawn([pos, { x: 0, y: 0 }], [vel, { dx: 1, dy: 0 }], [player, true]);
			w.spawn([pos, { x: 5, y: 5 }], [vel, { dx: 0, dy: 0 }], [enemy, true]);
			w.spawn([pos, { x: 9, y: 9 }], [player, true]);

			const ids = w.query_data([pos, vel] as const, [player] as const).collect().map(([id]) => id);
			expect(ids).toEqual([p]);
		});

		test("yielded tuple length equals data length (markers stripped)", () => {
			const w = world();
			w.spawn([pos, { x: 1, y: 2 }], [vel, { dx: 3, dy: 4 }], [player, true]);
			const all = w.query_data([pos, vel] as const, [player] as const).collect();
			expect(all).toHaveLength(1);
			const tuple = all[0]!;
			expect(tuple).toHaveLength(3);
			const [, p, v] = tuple;
			expect(p).toEqual({ x: 1, y: 2 });
			expect(v).toEqual({ dx: 3, dy: 4 });
		});

		test("empty markers list behaves like plain query", () => {
			const w = world();
			const a = w.spawn([pos, { x: 0, y: 0 }], [vel, { dx: 1, dy: 0 }]);
			w.spawn([pos, { x: 5, y: 5 }]);

			const ids = w.query_data([pos, vel] as const, [] as const).collect().map(([id]) => id);
			expect(ids).toEqual([a]);
		});

		test("empty data with markers yields entity ids and an empty data tuple", () => {
			const w = world();
			const a = w.spawn([pos, { x: 0, y: 0 }], [player, true]);
			w.spawn([pos, { x: 5, y: 5 }]);
			const c = w.spawn([player, true]);

			const tuples = w.query_data([] as const, [player] as const).collect();
			const ids = tuples.map(([id]) => id);
			expect(ids).toContain(a);
			expect(ids).toContain(c);
			expect(ids).not.toContain(w.spawn([pos, { x: 100, y: 100 }]));
			for (const tuple of tuples) {
				expect(tuple).toHaveLength(1);
			}
		});

		test("marker order is irrelevant", () => {
			const w = world();
			w.spawn([pos, { x: 0, y: 0 }], [player, true], [enemy, true]);
			const a_first = w.query_data([pos] as const, [player, enemy] as const).collect().map(([id]) => id);
			const e_first = w.query_data([pos] as const, [enemy, player] as const).collect().map(([id]) => id);
			expect(a_first).toEqual(e_first);
			expect(a_first).toHaveLength(1);
		});

		test("without filter still works alongside markers", () => {
			const w = world();
			const alive = w.spawn([pos, { x: 0, y: 0 }], [player, true]);
			const corpse = w.spawn([pos, { x: 5, y: 5 }], [player, true], [dead, true]);

			const ids = w
				.query_data([pos] as const, [player] as const, { without: [dead] })
				.collect()
				.map(([id]) => id);
			expect(ids).toContain(alive);
			expect(ids).not.toContain(corpse);
		});

		test("returns empty when a marker store is missing entirely", () => {
			const w = world();
			w.spawn([pos, { x: 0, y: 0 }]);
			const out = w.query_data([pos] as const, [player] as const).collect();
			expect(out).toEqual([]);
		});

		test("collect returns a snapshot independent of subsequent mutation", () => {
			const w = world();
			for (let i = 0; i < 3; i++) w.spawn([pos, { x: i, y: 0 }], [player, true]);
			const snap = w.query_data([pos] as const, [player] as const).collect();
			expect(snap).toHaveLength(3);
			for (const [id] of snap) w.despawn(id);
			expect(w.count()).toBe(0);
			expect(snap).toHaveLength(3);
		});
	});
});
