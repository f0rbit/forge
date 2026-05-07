import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
	component,
	resource,
	resources,
	rng,
	snapshotter,
	time,
	world,
	type Snapshot,
} from "../../src/index.ts";
import { atlas_registry_r, anim_c, anim_events_r } from "../../src/anim.ts";

const pos = component<{ x: number; y: number }>("pos");
const vel = component<{ dx: number; dy: number }>("vel");
const tag = component<{ jumps: number }>("player");

const pos_schema = z.object({ x: z.number(), y: z.number() });
const vel_schema = z.object({ dx: z.number(), dy: z.number() });
const tag_schema = z.object({ jumps: z.number().int() });

const score = resource<number>("test.score");

const make_full = () => {
	const w = world();
	const t = time();
	const r = rng(42);
	const res = resources();
	res.set(score, 100);
	w.spawn([pos, { x: 1, y: 2 }], [vel, { dx: 0.5, dy: -1 }], [tag, { jumps: 3 }]);
	w.spawn([pos, { x: 5, y: 6 }]);
	for (let i = 0; i < 17; i++) t.advance(t.fixed_dt);
	for (let i = 0; i < 10; i++) r.next();
	return { w, t, r, res };
};

const make_snapshotter = () =>
	snapshotter()
		.register(pos, pos_schema)
		.register(vel, vel_schema)
		.register(tag, tag_schema)
		.register_resource(score, z.number());

describe("snapshot.take/restore round-trip", () => {
	test("take returns ok with all registered components and resources", () => {
		const { w, t, r, res } = make_full();
		const s = make_snapshotter();
		const result = s.take(w, { time: t, rng: r, res });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.version).toBe(1);
		expect(result.value.entities.length).toBe(2);
		expect(result.value.entities[0]?.components["pos"]).toEqual({ x: 1, y: 2 });
		expect(result.value.entities[0]?.components["vel"]).toEqual({ dx: 0.5, dy: -1 });
		expect(result.value.entities[0]?.components["player"]).toEqual({ jumps: 3 });
		expect(result.value.entities[1]?.components["pos"]).toEqual({ x: 5, y: 6 });
		expect(result.value.resources["test.score"]).toBe(100);
		expect(result.value.meta.tick).toBe(17);
		expect(result.value.meta.rng_seed).toBe(42);
	});

	test("restore reproduces world byte-equal from snapshot", () => {
		const { w, t, r, res } = make_full();
		const s = make_snapshotter();
		const taken = s.take(w, { time: t, rng: r, res });
		expect(taken.ok).toBe(true);
		if (!taken.ok) return;

		const w2 = world();
		const t2 = time();
		const r2 = rng(taken.value.meta.rng_seed);
		const res2 = resources();

		const restored = s.restore(w2, taken.value, { time: t2, rng: r2, res: res2 });
		expect(restored.ok).toBe(true);

		const taken2 = s.take(w2, { time: t2, rng: r2, res: res2 });
		expect(taken2.ok).toBe(true);
		if (!taken2.ok) return;

		expect(JSON.stringify(taken2.value)).toBe(JSON.stringify(taken.value));
		expect(t2.tick).toBe(t.tick);
		expect(r2.state()).toBe(r.state());
		const score_r = res2.get(score);
		expect(score_r.ok).toBe(true);
		if (score_r.ok) expect(score_r.value).toBe(100);
	});

	test("restore preserves entity ids exactly", () => {
		const { w, t, r, res } = make_full();
		const s = make_snapshotter();
		const taken = s.take(w, { time: t, rng: r, res });
		if (!taken.ok) throw new Error("expected ok");

		const w2 = world();
		s.restore(w2, taken.value, {});

		const original_ids = taken.value.entities.map(e => e.id);
		const taken2 = s.take(w2, { time: time(), rng: rng(0), res: resources() });
		if (!taken2.ok) throw new Error("expected ok");
		const new_ids = taken2.value.entities.map(e => e.id);
		expect(new_ids).toEqual(original_ids);
	});

	test("restore returns version_mismatch on wrong version", () => {
		const s = make_snapshotter();
		const w = world();
		const bad: Snapshot = {
			version: 2 as 1,
			meta: { tick: 0, rng_state: 0, rng_seed: 0 },
			entities: [],
			resources: {},
		};
		const r = s.restore(w, bad, {});
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("snapshot_version_mismatch");
	});

	test("restore returns component_not_registered for unknown component", () => {
		const s = snapshotter().register(pos, pos_schema);
		const w = world();
		const snap: Snapshot = {
			version: 1,
			meta: { tick: 0, rng_state: 0, rng_seed: 0 },
			entities: [{ id: 1, components: { unknown_thing: { foo: 1 } } }],
			resources: {},
		};
		const r = s.restore(w, snap, {});
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.kind).toBe("component_not_registered");
			if (r.error.kind === "component_not_registered") {
				expect(r.error.component).toBe("unknown_thing");
			}
		}
	});

	test("take skips unregistered components silently (runtime-only state)", () => {
		const ghost = component<{ runtime: number }>("ghost");
		const w = world();
		w.spawn([pos, { x: 1, y: 2 }], [ghost, { runtime: 999 }]);
		const s = snapshotter().register(pos, pos_schema);
		const taken = s.take(w, { time: time(), rng: rng(1), res: resources() });
		expect(taken.ok).toBe(true);
		if (!taken.ok) return;
		expect(taken.value.entities[0]?.components["pos"]).toBeDefined();
		expect(taken.value.entities[0]?.components["ghost"]).toBeUndefined();
	});

	test("validation failure returns snapshot_validation_failed", () => {
		const w = world();
		w.spawn([pos, { x: "not-a-number" as unknown as number, y: 2 }]);
		const s = snapshotter().register(pos, pos_schema);
		const taken = s.take(w, { time: time(), rng: rng(1), res: resources() });
		expect(taken.ok).toBe(false);
		if (!taken.ok) expect(taken.error.kind).toBe("snapshot_validation_failed");
	});
});

describe("snapshot — kernel components/resources", () => {
	test("anim_c snapshots and restores when registered (it's data, not runtime)", () => {
		const w = world();
		w.spawn([anim_c, { atlas: "p", sequence: "idle", frame: 2, t: 0.3, speed: 1, loop: true, done: false }]);
		const s = snapshotter().register(anim_c);
		const taken = s.take(w, { time: time(), rng: rng(0), res: resources() });
		expect(taken.ok).toBe(true);
		if (!taken.ok) return;
		expect(taken.value.entities[0]?.components["anim"]).toBeDefined();
	});

	test("atlas_registry_r resource is NOT snapshotted by default (runtime asset metadata)", () => {
		const w = world();
		const res = resources();
		res.set(atlas_registry_r, { p: { idle: [{ frame: "p_0", ticks: 1 }] } });
		const s = snapshotter().register(anim_c);
		const taken = s.take(w, { time: time(), rng: rng(0), res });
		expect(taken.ok).toBe(true);
		if (!taken.ok) return;
		expect(Object.keys(taken.value.resources)).not.toContain("forge.anim.atlas_registry");
	});

	test("anim_events_r resource is NOT snapshotted by default (transient per-tick)", () => {
		const w = world();
		const res = resources();
		res.set(anim_events_r, { events: [{ kind: "looped", id: 1 as never, sequence: "idle", tick: 5 }] });
		const s = snapshotter();
		const taken = s.take(w, { time: time(), rng: rng(0), res });
		expect(taken.ok).toBe(true);
		if (!taken.ok) return;
		expect(Object.keys(taken.value.resources)).not.toContain("forge.anim.events");
	});

	test("Time tick IS snapshotted and round-trips exactly", () => {
		const w = world();
		const t = time();
		for (let i = 0; i < 42; i++) t.advance(t.fixed_dt);
		const s = snapshotter();
		const taken = s.take(w, { time: t, rng: rng(7), res: resources() });
		expect(taken.ok).toBe(true);
		if (!taken.ok) return;
		expect(taken.value.meta.tick).toBe(42);

		const t2 = time();
		s.restore(world(), taken.value, { time: t2 });
		expect(t2.tick).toBe(42);
	});

	test("Rng state IS snapshotted and restoring resumes the sequence", () => {
		const r = rng(99);
		for (let i = 0; i < 5; i++) r.next();
		const s = snapshotter();
		const taken = s.take(world(), { time: time(), rng: r, res: resources() });
		if (!taken.ok) throw new Error("expected ok");
		const next_after = r.next();

		const r2 = rng(0);
		s.restore(world(), taken.value, { rng: r2 });
		const next_restored = r2.next();
		expect(next_restored).toBe(next_after);
	});
});
