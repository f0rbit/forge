import { describe, expect, test } from "bun:test";
import {
	world,
	schedule,
	time,
	rng,
	resources,
	input,
	component,
	replay,
	debug_noop,
	palette_noop,
	type Ctx,
	type RawInput,
	type System,
	type World,
	type ReplayDoc,
} from "../../src/index.ts";
import { presets } from "../../src/presets/index.ts";

const pos = component<{ x: number; y: number }>("pos");
const vel = component<{ dx: number; dy: number }>("vel");
const player_tag = component<{ jumps: number }>("player");

const make_world = (): { w: World; ctx: Ctx; sch: ReturnType<typeof schedule> } => {
	const w = world();
	const sch = schedule();
	const t = time();
	const i = input(presets.platformer);
	const ctx: Ctx = {
		time: t,
		rng: rng(1),
		res: resources(),
		input: i,
		debug: debug_noop(),
		palette: palette_noop(),
	};

	const movement: System = (w, ctx) => {
		const ax = ctx.input.axis("move.x");
		for (const [, p, v] of w.query([pos, vel] as const)) {
			v.dx = ax * 60;
			p.x += v.dx * ctx.time.fixed_dt;
			p.y += v.dy * ctx.time.fixed_dt;
		}
	};

	const jumper: System = (w, ctx) => {
		if (!ctx.input.just("jump")) return;
		for (const [id] of w.query([player_tag] as const)) {
			const tag = w.get(id, player_tag);
			if (!tag.ok) continue;
			w.set(id, player_tag, { jumps: tag.value.jumps + 1 });
			const v = w.get(id, vel);
			if (v.ok) v.value.dy = -200;
		}
	};

	const gravity: System = w => {
		for (const [, , v] of w.query([pos, vel] as const)) {
			v.dy = Math.min(v.dy + 9.8, 600);
		}
	};

	sch.add("update", movement, "movement");
	sch.add("update", jumper, "jumper");
	sch.add("update", gravity, "gravity");

	w.spawn(
		[pos, { x: 0, y: 0 }],
		[vel, { dx: 0, dy: 0 }],
		[player_tag, { jumps: 0 }],
	);

	return { w, ctx, sch };
};

const hash_world = (w: World): string => {
	const entities: Array<readonly [number, Record<string, unknown>]> = [];
	for (const [id] of w.query([pos] as const)) {
		const components: Record<string, unknown> = {};
		const p = w.get(id, pos);
		if (p.ok) components["pos"] = p.value;
		const v = w.get(id, vel);
		if (v.ok) components["vel"] = v.value;
		const t = w.get(id, player_tag);
		if (t.ok) components["player"] = t.value;
		entities.push([id as unknown as number, components]);
	}
	entities.sort((a, b) => a[0] - b[0]);
	return JSON.stringify(entities);
};

const run_with_source = (source_for_tick: (tick: number) => readonly RawInput[], total_ticks: number): { hashes: string[]; doc?: ReplayDoc; final_world: World } => {
	const { w, ctx, sch } = make_world();
	let cur_tick = 0;
	ctx.input.source({
		drain: () => source_for_tick(cur_tick),
	});

	const rec = replay.record(ctx.input, { seed: 1, fixed_dt: ctx.time.fixed_dt, get_tick: () => ctx.time.tick });

	const hashes: string[] = [];
	for (let i = 0; i < total_ticks; i++) {
		cur_tick = i;
		ctx.time.advance(ctx.time.fixed_dt);
		sch.run("pre", w, ctx);
		ctx.input.advance(w, ctx);
		sch.run("update", w, ctx);
		sch.run("post", w, ctx);
		hashes.push(hash_world(w));
	}
	const doc = rec.stop();
	return { hashes, doc, final_world: w };
};

const run_with_replay = (doc: ReplayDoc, total_ticks: number): { hashes: string[]; final_world: World } => {
	const { w, ctx, sch } = make_world();
	const player = replay.play(doc, ctx.input, () => ctx.time.tick);

	const hashes: string[] = [];
	for (let i = 0; i < total_ticks; i++) {
		ctx.time.advance(ctx.time.fixed_dt);
		sch.run("pre", w, ctx);
		ctx.input.advance(w, ctx);
		sch.run("update", w, ctx);
		sch.run("post", w, ctx);
		hashes.push(hash_world(w));
	}
	player.detach();
	return { hashes, final_world: w };
};

const TICKS = 120;

const scripted_input = (tick: number): readonly RawInput[] => {
	if (tick === 0) return [{ kind: "key.down", code: "ArrowRight", pad: null, t: 0 }];
	if (tick === 30) {
		return [
			{ kind: "key.up", code: "ArrowRight", pad: null, t: 0 },
			{ kind: "key.down", code: "ArrowLeft", pad: null, t: 0 },
		];
	}
	if (tick === 50) return [{ kind: "key.down", code: "Space", pad: null, t: 0 }];
	if (tick === 51) return [{ kind: "key.up", code: "Space", pad: null, t: 0 }];
	if (tick === 90) return [{ kind: "key.up", code: "ArrowLeft", pad: null, t: 0 }];
	return [];
};

describe("replay determinism — Phase 2 deliverable", () => {
	test("recorded replay reproduces the original world hash sequence at every tick", () => {
		const original = run_with_source(scripted_input, TICKS);
		expect(original.doc).toBeDefined();
		expect(original.hashes.length).toBe(TICKS);

		const replayed = run_with_replay(original.doc as ReplayDoc, TICKS);
		expect(replayed.hashes.length).toBe(TICKS);

		for (let i = 0; i < TICKS; i++) {
			expect(replayed.hashes[i]).toBe(original.hashes[i] as string);
		}
	});

	test("two playbacks of the same replay produce identical hash sequences", () => {
		const original = run_with_source(scripted_input, TICKS);
		const a = run_with_replay(original.doc as ReplayDoc, TICKS);
		const b = run_with_replay(original.doc as ReplayDoc, TICKS);
		expect(a.hashes).toEqual(b.hashes);
		expect(a.hashes).toEqual(original.hashes);
	});

	test("two original runs from the same scripted source hash-equal", () => {
		const a = run_with_source(scripted_input, TICKS);
		const b = run_with_source(scripted_input, TICKS);
		expect(a.hashes).toEqual(b.hashes);
	});

	test("recorded replay survives JSON save/load round-trip", () => {
		const original = run_with_source(scripted_input, TICKS);
		const json = replay.save(original.doc as ReplayDoc);
		const loaded = replay.load(json);
		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;
		const replayed = run_with_replay(loaded.value, TICKS);
		expect(replayed.hashes).toEqual(original.hashes);
	});

	test("player jumps at tick 50 — recorded press flips the action", () => {
		const original = run_with_source(scripted_input, TICKS);
		expect(original.doc?.frames.some(f => f.events.some(e => e.kind === "press" && e.action === "jump"))).toBe(true);
		let player_id = -1;
		for (const [id] of original.final_world.query([player_tag] as const)) player_id = id as unknown as number;
		expect(player_id).toBeGreaterThan(0);
	});
});
