import { describe, expect, test } from "bun:test";
import { world, pos_c, follow_c, follow_system } from "../src/index.ts";
import { make_ctx } from "./helpers/ctx.ts";

describe("follow_system", () => {
	test("follower pos = target.pos + offset on next tick", () => {
		const w = world();
		const target = w.spawn([pos_c, { x: 100, y: 50 }]);
		const follower = w.spawn(
			[pos_c, { x: 0, y: 0 }],
			[follow_c, { target, offset: { x: 5, y: -10 } }],
		);
		follow_system(pos_c)(w, make_ctx());
		const got = w.get(follower, pos_c);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toEqual({ x: 105, y: 40 });
	});

	test("multiple followers tracking same target update independently", () => {
		const w = world();
		const target = w.spawn([pos_c, { x: 10, y: 20 }]);
		const a = w.spawn([pos_c, { x: 0, y: 0 }], [follow_c, { target, offset: { x: 1, y: 0 } }]);
		const b = w.spawn([pos_c, { x: 0, y: 0 }], [follow_c, { target, offset: { x: 0, y: 1 } }]);
		const c = w.spawn([pos_c, { x: 0, y: 0 }], [follow_c, { target, offset: { x: -3, y: -4 } }]);
		follow_system(pos_c)(w, make_ctx());
		const ar = w.get(a, pos_c);
		const br = w.get(b, pos_c);
		const cr = w.get(c, pos_c);
		expect(ar.ok && ar.value).toEqual({ x: 11, y: 20 });
		expect(br.ok && br.value).toEqual({ x: 10, y: 21 });
		expect(cr.ok && cr.value).toEqual({ x: 7, y: 16 });
	});

	test("follower whose target was despawned silently skips", () => {
		const w = world();
		const target = w.spawn([pos_c, { x: 50, y: 50 }]);
		const follower = w.spawn(
			[pos_c, { x: 1, y: 2 }],
			[follow_c, { target, offset: { x: 0, y: 0 } }],
		);
		w.despawn(target);
		expect(() => follow_system(pos_c)(w, make_ctx())).not.toThrow();
		const got = w.get(follower, pos_c);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toEqual({ x: 1, y: 2 });
	});

	test("zero offset places follower exactly at target", () => {
		const w = world();
		const target = w.spawn([pos_c, { x: 42, y: 7 }]);
		const follower = w.spawn(
			[pos_c, { x: 999, y: 999 }],
			[follow_c, { target, offset: { x: 0, y: 0 } }],
		);
		follow_system(pos_c)(w, make_ctx());
		const got = w.get(follower, pos_c);
		expect(got.ok && got.value).toEqual({ x: 42, y: 7 });
	});

	test("negative offset works", () => {
		const w = world();
		const target = w.spawn([pos_c, { x: 0, y: 0 }]);
		const follower = w.spawn(
			[pos_c, { x: 0, y: 0 }],
			[follow_c, { target, offset: { x: -16, y: -32 } }],
		);
		follow_system(pos_c)(w, make_ctx());
		const got = w.get(follower, pos_c);
		expect(got.ok && got.value).toEqual({ x: -16, y: -32 });
	});

	test("deterministic — same setup yields same result twice", () => {
		const setup = () => {
			const w = world();
			const t = w.spawn([pos_c, { x: 33, y: 44 }]);
			const f = w.spawn([pos_c, { x: 0, y: 0 }], [follow_c, { target: t, offset: { x: 2, y: 3 } }]);
			follow_system(pos_c)(w, make_ctx());
			const r = w.get(f, pos_c);
			return r.ok ? r.value : null;
		};
		expect(setup()).toEqual(setup());
	});

	test("follower with no follow_c is untouched (system is a no-op when zero matches)", () => {
		const w = world();
		const e = w.spawn([pos_c, { x: 7, y: 8 }]);
		follow_system(pos_c)(w, make_ctx());
		const got = w.get(e, pos_c);
		expect(got.ok && got.value).toEqual({ x: 7, y: 8 });
	});
});
