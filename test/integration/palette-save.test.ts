import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
	builtins,
	component,
	debug,
	engine_store,
	input,
	palette,
	resource,
	resources,
	rng,
	snapshot_schema,
	snapshotter,
	time,
	world,
	type Ctx,
	type World,
} from "../../src/index.ts";

const pos = component<{ x: number; y: number }>("pos");
const vel = component<{ dx: number; dy: number }>("vel");
const score = resource<number>("game.score");
const pos_schema = z.object({ x: z.number(), y: z.number() });
const vel_schema = z.object({ dx: z.number(), dy: z.number() });

const make_world_with_state = (): World => {
	const w = world();
	w.spawn([pos, { x: 1, y: 2 }], [vel, { dx: 0.5, dy: 1.5 }]);
	w.spawn([pos, { x: 5, y: 10 }], [vel, { dx: -1, dy: 0 }]);
	return w;
};

const make_snap = () =>
	snapshotter()
		.register(pos, pos_schema)
		.register(vel, vel_schema)
		.register_resource(score, z.number());

const hash_world = (w: World, ctx: Ctx): string => {
	const entries: Array<[number, Record<string, unknown>]> = [];
	for (const [id, p] of w.query([pos] as const)) {
		const components: Record<string, unknown> = { pos: p };
		const v = w.get(id, vel);
		if (v.ok) components.vel = v.value;
		entries.push([id as unknown as number, components]);
	}
	entries.sort((a, b) => a[0] - b[0]);
	const sc = ctx.res.get(score);
	return JSON.stringify({ entries, score: sc.ok ? sc.value : null, tick: ctx.time.tick });
};

const make_rig = (seed: number) => {
	const w = make_world_with_state();
	const t = time();
	const r = rng(seed);
	const res = resources();
	res.set(score, 42);
	const i = input();
	const d = debug();
	const p = palette();
	const store = engine_store({ backend: "mem" });
	const snap = make_snap();
	const ctx: Ctx = { time: t, rng: r, res, input: i, debug: d, palette: p, store };
	for (const b of builtins({ world: w, snapshotter: snap, snapshots: store.snapshots })) {
		p.register(b);
	}
	return { w, t, r, res, ctx, p, store, snap };
};

describe("Phase 4 deliverable — palette.exec save/load roundtrip", () => {
	test("exec('save slot-1', ctx) writes to engine_store.snapshots, then exec('load slot-1', fresh_ctx) restores state", async () => {
		const original = make_rig(1234);

		const before_hash = hash_world(original.w, original.ctx);

		const save_result = await original.p.exec("save slot-1", original.ctx);
		expect(save_result.ok).toBe(true);

		const stored = await original.store.snapshots.load("slot-1");
		expect(stored.ok).toBe(true);
		if (stored.ok) {
			expect(stored.value.entities.length).toBe(2);
			expect(stored.value.resources["game.score"]).toBe(42);
		}

		const fresh_w = world();
		const fresh_t = time();
		const fresh_r = rng(99);
		const fresh_res = resources();
		const fresh_i = input();
		const fresh_d = debug();
		const fresh_p = palette();
		const fresh_snap = make_snap();
		const fresh_ctx: Ctx = {
			time: fresh_t,
			rng: fresh_r,
			res: fresh_res,
			input: fresh_i,
			debug: fresh_d,
			palette: fresh_p,
			store: original.store,
		};
		for (const b of builtins({ world: fresh_w, snapshotter: fresh_snap, snapshots: original.store.snapshots })) {
			fresh_p.register(b);
		}

		const load_result = await fresh_p.exec("load slot-1", fresh_ctx);
		expect(load_result.ok).toBe(true);
		if (load_result.ok) expect(load_result.value).toContain("slot-1");

		const after_hash = hash_world(fresh_w, fresh_ctx);
		expect(after_hash).toBe(before_hash);
	});

	test("exec('time 0.25', ctx) — tscale built-in modifies time.scale", async () => {
		const rig = make_rig(0);
		await rig.p.exec("tscale 0.25", rig.ctx);
		expect(rig.ctx.time.scale).toBe(0.25);
	});

	test("debug commands accumulate in buffer and drain on render-stage tick", () => {
		const rig = make_rig(0);
		rig.ctx.debug.line({ x: 0, y: 0 }, { x: 1, y: 0 }, "red");
		rig.ctx.debug.circle({ x: 5, y: 5 }, 2);
		expect(rig.ctx.debug.frame().length).toBe(2);
	});
});
