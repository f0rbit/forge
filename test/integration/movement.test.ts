import { describe, expect, test } from "bun:test";
import { world, schedule, time, component, type System, type World } from "../../src/index.ts";
import { make_ctx } from "../helpers/ctx.ts";

const pos = component<{ x: number; y: number }>("pos");
const vel = component<{ dx: number; dy: number }>("vel");

const movement: System = (w, ctx) => {
	for (const [, p, v] of w.query([pos, vel] as const)) {
		p.x += v.dx * ctx.time.fixed_dt;
		p.y += v.dy * ctx.time.fixed_dt;
	}
};

const snapshot = (w: World) => {
	const out: Array<readonly [number, { x: number; y: number }, { dx: number; dy: number }]> = [];
	for (const [id, p, v] of w.query([pos, vel] as const)) {
		out.push([id as unknown as number, { ...p }, { ...v }]);
	}
	return JSON.stringify(out);
};

const run_60_ticks = () => {
	const w = world();
	const sch = schedule();
	const t = time();
	const ctx = make_ctx({ time: t });

	sch.add("update", movement, "movement");

	const a = w.spawn([pos, { x: 0, y: 0 }], [vel, { dx: 1, dy: 0.5 }]);
	const b = w.spawn([pos, { x: 100, y: 100 }], [vel, { dx: -2, dy: 0 }]);

	for (let i = 0; i < 60; i++) {
		t.advance(t.fixed_dt);
		sch.run("update", w, ctx);
	}
	return { w, snap: snapshot(w), a, b };
};

describe("movement integration — determinism", () => {
	test("60 ticks of fixed-dt movement land on the expected positions", () => {
		const { w, a, b } = run_60_ticks();

		const pa = w.get(a, pos);
		expect(pa.ok).toBe(true);
		if (pa.ok) {
			expect(pa.value.x).toBeCloseTo(60 * (1 / 60), 10);
			expect(pa.value.y).toBeCloseTo(60 * 0.5 * (1 / 60), 10);
		}
		const pb = w.get(b, pos);
		expect(pb.ok).toBe(true);
		if (pb.ok) {
			expect(pb.value.x).toBeCloseTo(100 + 60 * -2 * (1 / 60), 10);
			expect(pb.value.y).toBeCloseTo(100, 10);
		}
	});

	test("two runs from the same setup produce byte-identical world snapshots", () => {
		const run_a = run_60_ticks();
		const run_b = run_60_ticks();
		expect(run_b.snap).toBe(run_a.snap);
	});
});
