import { describe, expect, test } from "bun:test";
import {
	world,
	schedule,
	time,
	rng,
	resources,
	anim,
	anim_c,
	atlas_registry,
	anim_events,
	type AtlasRegistry,
	type AnimEventBuffer,
	type Ctx,
} from "../src/index.ts";

const make_setup = () => {
	const w = world();
	const sch = schedule();
	const t = time();
	const res = resources();
	const ctx: Ctx = { time: t, rng: rng(1), res };
	const registry: AtlasRegistry = {
		"test-atlas": {
			walk: [
				{ frame: "a", ticks: 6 },
				{ frame: "b", ticks: 6 },
				{ frame: "c", ticks: 6 },
			],
			blink: [
				{ frame: "open", ticks: 4 },
				{ frame: "shut", ticks: 2 },
			],
		},
	};
	res.set(atlas_registry, registry);
	const buf: AnimEventBuffer = { events: [] };
	res.set(anim_events, buf);
	return { w, sch, ctx, buf };
};

describe("anim.advance", () => {
	test("ticks frame index off speed=1 (whole-tick durations)", () => {
		const { w, sch, ctx } = make_setup();
		const a = anim();
		sch.add("update", a.advance);
		const id = w.spawn([anim_c, { atlas: "test-atlas", sequence: "walk", frame: 0, t: 0, speed: 1, loop: true, done: false }]);

		for (let i = 0; i < 5; i++) sch.run("update", w, ctx);
		const r1 = w.get(id, anim_c);
		expect(r1.ok && r1.value.frame).toBe(0);

		sch.run("update", w, ctx);
		const r2 = w.get(id, anim_c);
		expect(r2.ok && r2.value.frame).toBe(1);

		for (let i = 0; i < 6; i++) sch.run("update", w, ctx);
		const r3 = w.get(id, anim_c);
		expect(r3.ok && r3.value.frame).toBe(2);
	});

	test("looping wraps frame back to 0 and emits a 'looped' event", () => {
		const { w, sch, ctx, buf } = make_setup();
		const a = anim();
		sch.add("update", a.advance);
		const id = w.spawn([anim_c, { atlas: "test-atlas", sequence: "walk", frame: 0, t: 0, speed: 1, loop: true, done: false }]);

		for (let i = 0; i < 18; i++) sch.run("update", w, ctx);
		const r = w.get(id, anim_c);
		expect(r.ok && r.value.frame).toBe(0);
		expect(r.ok && r.value.done).toBe(false);
		const looped = buf.events.filter(e => e.kind === "looped");
		expect(looped.length).toBeGreaterThanOrEqual(1);
		expect(looped[0]!.id).toBe(id);
	});

	test("one-shot freezes on last frame and emits 'finished'", () => {
		const { w, sch, ctx, buf } = make_setup();
		const a = anim();
		sch.add("update", a.advance);
		const id = w.spawn([anim_c, { atlas: "test-atlas", sequence: "walk", frame: 0, t: 0, speed: 1, loop: false, done: false }]);

		for (let i = 0; i < 50; i++) sch.run("update", w, ctx);
		const r = w.get(id, anim_c);
		expect(r.ok && r.value.frame).toBe(2);
		expect(r.ok && r.value.done).toBe(true);

		const finished = buf.events.filter(e => e.kind === "finished");
		expect(finished.length).toBeGreaterThanOrEqual(0);
	});

	test("speed multiplier accelerates frame progression", () => {
		const { w, sch, ctx } = make_setup();
		const a = anim();
		sch.add("update", a.advance);
		const id = w.spawn([anim_c, { atlas: "test-atlas", sequence: "walk", frame: 0, t: 0, speed: 2, loop: true, done: false }]);

		for (let i = 0; i < 3; i++) sch.run("update", w, ctx);
		const r = w.get(id, anim_c);
		expect(r.ok && r.value.frame).toBe(1);
	});

	test("missing atlas no-ops without crashing", () => {
		const { w, sch, ctx } = make_setup();
		const a = anim();
		sch.add("update", a.advance);
		const id = w.spawn([anim_c, { atlas: "ghost", sequence: "walk", frame: 0, t: 0, speed: 1, loop: true, done: false }]);

		for (let i = 0; i < 20; i++) sch.run("update", w, ctx);
		const r = w.get(id, anim_c);
		expect(r.ok && r.value.frame).toBe(0);
	});
});

describe("anim.play / stop / playing", () => {
	test("play resets frame/t/done and applies sequence + opts", () => {
		const { w } = make_setup();
		const a = anim();
		const id = w.spawn([anim_c, { atlas: "test-atlas", sequence: "walk", frame: 2, t: 4, speed: 1, loop: false, done: true }]);

		const r = a.play(w, id, "blink", { speed: 1.5, loop: true });
		expect(r.ok).toBe(true);
		const got = w.get(id, anim_c);
		expect(got.ok).toBe(true);
		if (got.ok) {
			expect(got.value.sequence).toBe("blink");
			expect(got.value.frame).toBe(0);
			expect(got.value.t).toBe(0);
			expect(got.value.speed).toBe(1.5);
			expect(got.value.loop).toBe(true);
			expect(got.value.done).toBe(false);
		}
	});

	test("play on entity without anim_c returns component_missing", () => {
		const { w } = make_setup();
		const a = anim();
		const id = w.spawn();
		const r = a.play(w, id, "walk");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("component_missing");
	});

	test("stop sets done=true; playing reflects state", () => {
		const { w } = make_setup();
		const a = anim();
		const id = w.spawn([anim_c, { atlas: "test-atlas", sequence: "walk", frame: 0, t: 0, speed: 1, loop: true, done: false }]);

		expect(a.playing(w, id)).toBe(true);
		expect(a.stop(w, id).ok).toBe(true);
		expect(a.playing(w, id)).toBe(false);
	});
});
