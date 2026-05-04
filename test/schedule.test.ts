import { describe, expect, test } from "bun:test";
import { schedule, world, time, rng, resources, type Ctx, type System } from "../src/index.ts";

const make_ctx = (): Ctx => ({ time: time(), rng: rng(1), res: resources() });

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
});
