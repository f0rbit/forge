import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
	component,
	file,
	load,
	mem,
	resource,
	resources,
	rng,
	save,
	schedule,
	snapshot_schema,
	snapshotter,
	time,
	world,
	debug_noop,
	palette_noop,
	input,
	type Ctx,
	type System,
	type World,
	type Time,
	type Rng,
	type Resources,
} from "../../src/index.ts";

const pos = component<{ x: number; y: number }>("pos");
const vel = component<{ dx: number; dy: number }>("vel");
const score = resource<number>("game.score");

const pos_schema = z.object({ x: z.number(), y: z.number() });
const vel_schema = z.object({ dx: z.number(), dy: z.number() });

type GameRig = {
	w: World;
	t: Time;
	r: Rng;
	res: Resources;
	ctx: Ctx;
	sch: ReturnType<typeof schedule>;
};

const make_game = (seed: number): GameRig => {
	const w = world();
	const t = time();
	const r = rng(seed);
	const res = resources();
	res.set(score, 0);
	const i = input();
	const ctx: Ctx = { time: t, rng: r, res, input: i, debug: debug_noop(), palette: palette_noop() };
	const sch = schedule();

	const movement: System = (w, ctx) => {
		for (const [, p, v] of w.query([pos, vel] as const)) {
			p.x += v.dx * ctx.time.fixed_dt;
			p.y += v.dy * ctx.time.fixed_dt;
		}
	};

	const scoring: System = (_w, ctx) => {
		const s = ctx.res.get(score);
		if (!s.ok) return;
		const next = s.value + ctx.rng.int(1, 3);
		ctx.res.set(score, next);
	};

	sch.add("update", movement, "movement");
	sch.add("update", scoring, "scoring");

	w.spawn([pos, { x: 0, y: 0 }], [vel, { dx: 1, dy: 2 }]);
	w.spawn([pos, { x: 10, y: 10 }], [vel, { dx: -1, dy: 0 }]);

	return { w, t, r, res, ctx, sch };
};

const make_snap = () =>
	snapshotter()
		.register(pos, pos_schema)
		.register(vel, vel_schema)
		.register_resource(score, z.number());

const run_ticks = (rig: GameRig, n: number) => {
	for (let i = 0; i < n; i++) {
		rig.t.advance(rig.t.fixed_dt);
		rig.sch.run("pre", rig.w, rig.ctx);
		rig.ctx.input.advance(rig.w, rig.ctx);
		rig.sch.run("update", rig.w, rig.ctx);
		rig.sch.run("post", rig.w, rig.ctx);
	}
};

const hash_state = (rig: GameRig): string => {
	const entities: Array<readonly [number, Record<string, unknown>]> = [];
	for (const [id] of rig.w.query([pos] as const)) {
		const components: Record<string, unknown> = {};
		const p = rig.w.get(id, pos);
		if (p.ok) components["pos"] = p.value;
		const v = rig.w.get(id, vel);
		if (v.ok) components["vel"] = v.value;
		entities.push([id as unknown as number, components]);
	}
	entities.sort((a, b) => a[0] - b[0]);
	const score_r = rig.res.get(score);
	return JSON.stringify({
		entities,
		score: score_r.ok ? score_r.value : null,
		tick: rig.t.tick,
		rng_state: rig.r.state(),
	});
};

describe("storage integration — Phase 3 deliverable", () => {
	test("60 ticks straight equals 30 ticks + save + restore in fresh world + 30 ticks (mem)", async () => {
		const continuous = make_game(1234);
		run_ticks(continuous, 60);
		const continuous_hash = hash_state(continuous);

		const split = make_game(1234);
		run_ticks(split, 30);
		const snap = make_snap();
		const store = mem({ schema: snapshot_schema });

		const saved = await save(split.w, snap, store, "tick-30", { time: split.t, rng: split.r, res: split.res });
		expect(saved.ok).toBe(true);

		const fresh = make_game(99999);
		const loaded = await load(fresh.w, snap, store, "tick-30", { time: fresh.t, rng: fresh.r, res: fresh.res });
		expect(loaded.ok).toBe(true);

		const split_hash_before = hash_state(split);
		const fresh_hash = hash_state(fresh);
		expect(fresh_hash).toBe(split_hash_before);

		run_ticks(fresh, 30);
		const final_hash = hash_state(fresh);
		expect(final_hash).toBe(continuous_hash);
	});

	test("60 ticks straight equals 30 + save-to-disk + load-from-disk + 30 (file)", async () => {
		const dir = mkdtempSync(join(tmpdir(), "forge-int-"));
		try {
			const continuous = make_game(7777);
			run_ticks(continuous, 60);
			const continuous_hash = hash_state(continuous);

			const split = make_game(7777);
			run_ticks(split, 30);
			const snap = make_snap();
			const store = file({ dir, schema: snapshot_schema });

			const saved = await save(split.w, snap, store, "checkpoint", { time: split.t, rng: split.r, res: split.res });
			expect(saved.ok).toBe(true);

			const fresh = make_game(11);
			const fresh_store = file({ dir, schema: snapshot_schema });
			const loaded = await load(fresh.w, snap, fresh_store, "checkpoint", { time: fresh.t, rng: fresh.r, res: fresh.res });
			expect(loaded.ok).toBe(true);

			run_ticks(fresh, 30);
			expect(hash_state(fresh)).toBe(continuous_hash);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("save then immediately load on the same world is idempotent", async () => {
		const rig = make_game(42);
		run_ticks(rig, 15);
		const before = hash_state(rig);

		const snap = make_snap();
		const store = mem({ schema: snapshot_schema });
		const saved = await save(rig.w, snap, store, "self", { time: rig.t, rng: rig.r, res: rig.res });
		expect(saved.ok).toBe(true);

		const loaded = await load(rig.w, snap, store, "self", { time: rig.t, rng: rig.r, res: rig.res });
		expect(loaded.ok).toBe(true);
		expect(hash_state(rig)).toBe(before);
	});

	test("two splits (10+50, 30+30) from the same seed converge to the same final hash", async () => {
		const target = make_game(2024);
		run_ticks(target, 60);
		const target_hash = hash_state(target);

		const snap = make_snap();
		const store = mem({ schema: snapshot_schema });

		const a = make_game(2024);
		run_ticks(a, 10);
		await save(a.w, snap, store, "a", { time: a.t, rng: a.r, res: a.res });
		const a_resume = make_game(0);
		await load(a_resume.w, snap, store, "a", { time: a_resume.t, rng: a_resume.r, res: a_resume.res });
		run_ticks(a_resume, 50);
		expect(hash_state(a_resume)).toBe(target_hash);

		const b = make_game(2024);
		run_ticks(b, 30);
		await save(b.w, snap, store, "b", { time: b.t, rng: b.r, res: b.res });
		const b_resume = make_game(0);
		await load(b_resume.w, snap, store, "b", { time: b_resume.t, rng: b_resume.r, res: b_resume.res });
		run_ticks(b_resume, 30);
		expect(hash_state(b_resume)).toBe(target_hash);
	});
});

describe("storage integration — error surface", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "forge-err-"));
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	test("load returns store-error wrapped when slot is missing", async () => {
		const fresh = make_game(0);
		const snap = make_snap();
		const store = file({ dir, schema: snapshot_schema });
		const r = await load(fresh.w, snap, store, "no-such", { time: fresh.t, rng: fresh.r, res: fresh.res });
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.kind).toBe("store");
			if (r.error.kind === "store") expect(r.error.cause.kind).toBe("not_found");
		}
	});
});
