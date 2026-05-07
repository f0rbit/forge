import { describe, expect, test } from "bun:test";
import { schedule, time, world, type System } from "../src/index.ts";
import { make_ctx } from "./helpers/ctx.ts";

describe("schedule", () => {
	test("add(stage, system) is chainable and runs systems in insertion order", () => {
		const sch = schedule();
		const calls: string[] = [];
		const sys = (label: string): System => () => calls.push(label);
		sch.add("update", sys("a")).add("update", sys("b")).add("update", sys("c"));
		sch.run("update", world(), make_ctx());
		expect(calls).toEqual(["a", "b", "c"]);
	});

	test("stages are isolated — running update doesn't run render", () => {
		const sch = schedule();
		const calls: string[] = [];
		sch.add("update", () => calls.push("update"));
		sch.add("render", () => calls.push("render"));
		sch.run("update", world(), make_ctx());
		expect(calls).toEqual(["update"]);
	});

	test("tick runs startup once then pre/update/post/render", () => {
		const sch = schedule();
		const calls: string[] = [];
		sch.add("startup", () => calls.push("startup"));
		sch.add("pre", () => calls.push("pre"));
		sch.add("update", () => calls.push("update"));
		sch.add("post", () => calls.push("post"));
		sch.add("render", () => calls.push("render"));

		const w = world();
		const ctx = make_ctx();
		sch.tick(w, ctx);
		sch.tick(w, ctx);
		expect(calls).toEqual(["startup", "pre", "update", "post", "render", "pre", "update", "post", "render"]);
	});

	test("remove(name) drops a system by name", () => {
		const sch = schedule();
		const calls: string[] = [];
		sch.add("update", () => calls.push("a"), "a");
		sch.add("update", () => calls.push("b"), "b");
		sch.remove("a");
		sch.run("update", world(), make_ctx());
		expect(calls).toEqual(["b"]);
	});

	describe("add with opts", () => {
		test("name as bare string positional argument is accepted", () => {
			const sch = schedule();
			const calls: string[] = [];
			sch.add("update", () => calls.push("a"), "a");
			sch.add("update", () => calls.push("b"), "b");
			sch.remove("a");
			sch.run("update", world(), make_ctx());
			expect(calls).toEqual(["b"]);
		});

		test("name as opts.name is accepted", () => {
			const sch = schedule();
			const calls: string[] = [];
			sch.add("update", () => calls.push("a"), { name: "a" });
			sch.add("update", () => calls.push("b"), { name: "b" });
			sch.remove("a");
			sch.run("update", world(), make_ctx());
			expect(calls).toEqual(["b"]);
		});

		test("opts.every fires only on ticks where tick % every === 0 (phase default)", () => {
			const sch = schedule();
			const t = time();
			const ctx = make_ctx({ time: t });
			const fired: number[] = [];
			sch.add("update", (_w, c) => fired.push(c.time.tick), { every: 6 });
			const w = world();
			for (let i = 0; i < 18; i++) {
				sch.run("update", w, ctx);
				ctx.time.advance(t.fixed_dt);
			}
			expect(fired).toEqual([0, 6, 12]);
		});

		test("every: 1 fires every tick (matches plain add)", () => {
			const sch = schedule();
			const t = time();
			const ctx = make_ctx({ time: t });
			const fired: number[] = [];
			sch.add("update", (_w, c) => fired.push(c.time.tick), { every: 1 });
			const w = world();
			for (let i = 0; i < 5; i++) {
				sch.run("update", w, ctx);
				ctx.time.advance(t.fixed_dt);
			}
			expect(fired).toEqual([0, 1, 2, 3, 4]);
		});

		test("opts.phase shifts the firing offset", () => {
			const sch = schedule();
			const t = time();
			const ctx = make_ctx({ time: t });
			const fired: number[] = [];
			sch.add("update", (_w, c) => fired.push(c.time.tick), { every: 6, phase: 3 });
			const w = world();
			for (let i = 0; i < 18; i++) {
				sch.run("update", w, ctx);
				ctx.time.advance(t.fixed_dt);
			}
			expect(fired).toEqual([3, 9, 15]);
		});

		test("multiple periodic systems with different every values interleave", () => {
			const sch = schedule();
			const t = time();
			const ctx = make_ctx({ time: t });
			const fired: Array<{ name: string; tick: number }> = [];
			sch.add("update", (_w, c) => fired.push({ name: "fast", tick: c.time.tick }), { every: 2 });
			sch.add("update", (_w, c) => fired.push({ name: "slow", tick: c.time.tick }), { every: 3 });
			const w = world();
			for (let i = 0; i < 6; i++) {
				sch.run("update", w, ctx);
				ctx.time.advance(t.fixed_dt);
			}
			expect(fired).toEqual([
				{ name: "fast", tick: 0 },
				{ name: "slow", tick: 0 },
				{ name: "fast", tick: 2 },
				{ name: "slow", tick: 3 },
				{ name: "fast", tick: 4 },
			]);
		});

		test("every: 0 throws at registration", () => {
			const sch = schedule();
			expect(() => sch.add("update", () => {}, { every: 0 })).toThrow(/positive integer/);
		});

		test("negative every throws at registration", () => {
			const sch = schedule();
			expect(() => sch.add("update", () => {}, { every: -3 })).toThrow(/positive integer/);
		});

		test("non-integer every throws at registration", () => {
			const sch = schedule();
			expect(() => sch.add("update", () => {}, { every: 2.5 })).toThrow(/positive integer/);
		});

		test("negative phase throws at registration", () => {
			const sch = schedule();
			expect(() => sch.add("update", () => {}, { every: 4, phase: -1 })).toThrow(/non-negative integer/);
		});

		test("named periodic systems can be removed by name", () => {
			const sch = schedule();
			const t = time();
			const ctx = make_ctx({ time: t });
			let count = 0;
			sch.add("update", () => count++, { every: 1, name: "p" });
			sch.remove("p");
			const w = world();
			for (let i = 0; i < 3; i++) {
				sch.run("update", w, ctx);
				ctx.time.advance(t.fixed_dt);
			}
			expect(count).toBe(0);
		});

		test("add with opts returns Schedule for chaining", () => {
			const sch = schedule();
			const result: System = () => {};
			expect(sch.add("update", result, { every: 2 })).toBe(sch);
		});
	});
});
