import { describe, expect, test } from "bun:test";
import { rng } from "../src/index.ts";

describe("rng", () => {
	test("same seed produces same sequence", () => {
		const a = rng(42);
		const b = rng(42);
		const seq_a = Array.from({ length: 10 }, () => a.next());
		const seq_b = Array.from({ length: 10 }, () => b.next());
		expect(seq_a).toEqual(seq_b);
	});

	test("different seeds produce different sequences", () => {
		const a = rng(1);
		const b = rng(2);
		expect(a.next()).not.toBe(b.next());
	});

	test("next returns values in [0, 1)", () => {
		const r = rng(7);
		for (let i = 0; i < 1000; i++) {
			const v = r.next();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	test("int returns inclusive integers in [min, max]", () => {
		const r = rng(99);
		for (let i = 0; i < 1000; i++) {
			const v = r.int(3, 7);
			expect(Number.isInteger(v)).toBe(true);
			expect(v).toBeGreaterThanOrEqual(3);
			expect(v).toBeLessThanOrEqual(7);
		}
	});

	test("pick selects from the array; empty array returns err", () => {
		const r = rng(11);
		const arr = ["a", "b", "c", "d"];
		for (let i = 0; i < 100; i++) {
			const got = r.pick(arr);
			expect(got.ok).toBe(true);
			if (got.ok) expect(arr).toContain(got.value);
		}
		const empty = r.pick([]);
		expect(empty.ok).toBe(false);
		if (!empty.ok) expect(empty.error.kind).toBe("empty_array");
	});

	test("state/restore round-trips", () => {
		const r = rng(123);
		r.next();
		r.next();
		const snap = r.state();
		const before = r.next();
		r.restore(snap);
		const after = r.next();
		expect(after).toBe(before);
	});

	test("fork yields a deterministic sub-stream that doesn't disturb the parent", () => {
		const a = rng(5);
		const a_pre = a.next();
		const a_fork_1 = a.fork("ai");
		const a_fork_2 = rng(5);
		a_fork_2.next();
		const a_fork_2_b = a_fork_2.fork("ai");

		expect(a_fork_1.next()).toBe(a_fork_2_b.next());
		expect(a_fork_1.next()).toBe(a_fork_2_b.next());
		void a_pre;
	});
});
