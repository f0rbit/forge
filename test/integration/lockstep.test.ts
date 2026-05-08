import { describe, expect, test } from "bun:test";
import { world, schedule, time } from "../../src/index.ts";
import { make_ctx } from "../helpers/ctx.ts";

const simulate = (
	real_dts: readonly number[],
	mode: "fixed" | "jitter",
	every: number,
) => {
	const w = world();
	const sch = schedule();
	const t = time();
	const ctx = make_ctx({ time: t });

	const fires: number[] = [];
	sch.add("update", (_w, c) => fires.push(c.time.tick), { every, name: "periodic" });

	const tick = (real_dt: number): void => {
		if (mode === "fixed") {
			const consumed = t.advance(real_dt);
			for (let i = 0; i < consumed; i++) sch.tick(w, ctx);
			return;
		}
		t.advance(real_dt, () => sch.tick(w, ctx));
	};

	for (const dt of real_dts) tick(dt);
	return { fires, final_tick: t.tick };
};

const jitter_pattern = (frames: number): number[] => {
	const dts: number[] = [];
	for (let i = 0; i < frames; i++) {
		const m = i % 10;
		if (m === 7) dts.push(0.032);
		else if (m === 3) dts.push(0.014);
		else if (m === 5) dts.push(0.017);
		else dts.push(0.016);
	}
	return dts;
};

describe("tick/schedule lockstep", () => {
	test("periodic system fires exactly once per matching consumed tick under real_dt jitter", () => {
		const dts = jitter_pattern(600);
		const { fires, final_tick } = simulate(dts, "jitter", 10);

		const expected = Math.floor(final_tick / 10);
		expect(fires.length).toBe(expected);

		const unique = new Set(fires);
		expect(unique.size).toBe(fires.length);

		for (const tick_value of fires) {
			expect(tick_value % 10).toBe(0);
			expect(tick_value).toBeGreaterThan(0);
		}
	});

	test("schedule does not run when no simulation tick is consumed (sub-fixed_dt frame)", () => {
		const w = world();
		const sch = schedule();
		const t = time();
		const ctx = make_ctx({ time: t });

		let runs = 0;
		sch.add("update", () => runs++, "counter");

		t.advance(1 / 240, () => sch.tick(w, ctx));
		expect(runs).toBe(0);
		expect(t.tick).toBe(0);

		t.advance(1 / 240, () => sch.tick(w, ctx));
		expect(runs).toBe(0);

		t.advance(1 / 240, () => sch.tick(w, ctx));
		t.advance(1 / 240, () => sch.tick(w, ctx));
		expect(runs).toBe(1);
		expect(t.tick).toBe(1);
	});

	test("schedule runs once per consumed tick on a slow frame (catch-up)", () => {
		const w = world();
		const sch = schedule();
		const t = time();
		const ctx = make_ctx({ time: t });

		const seen: number[] = [];
		sch.add("update", (_w, c) => seen.push(c.time.tick), "trace");

		const consumed = t.advance(t.fixed_dt * 4, () => sch.tick(w, ctx));
		expect(consumed).toBe(4);
		expect(seen).toEqual([1, 2, 3, 4]);
	});
});
