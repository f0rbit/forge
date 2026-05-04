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
});
