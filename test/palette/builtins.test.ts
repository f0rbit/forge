import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
	builtins,
	component,
	debug,
	engine_store,
	input,
	palette,
	rng,
	resources,
	snapshotter,
	time,
	world,
	type Ctx,
} from "../../src/index.ts";

const pos = component<{ x: number; y: number }>("pos");
const pos_schema = z.object({ x: z.number(), y: z.number() });

const make_rig = () => {
	const w = world();
	w.spawn([pos, { x: 1, y: 2 }]);
	const t = time();
	const r = rng(1);
	const res = resources();
	const i = input();
	const d = debug();
	const p = palette();
	const store = engine_store({ backend: "mem" });
	const snap = snapshotter().register(pos, pos_schema);
	const ctx: Ctx = { time: t, rng: r, res, input: i, debug: d, palette: p, store };
	for (const b of builtins({ world: w, snapshotter: snap, snapshots: store.snapshots })) {
		p.register(b);
	}
	return { w, t, ctx, p, store };
};

describe("palette built-ins", () => {
	test("save writes to engine_store.snapshots", async () => {
		const rig = make_rig();
		const r = await rig.p.exec("save slot-1", rig.ctx);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value).toContain("slot-1");
		expect(await rig.store.snapshots.has("slot-1")).toBe(true);
	});

	test("load returns runtime error on unknown slot", async () => {
		const rig = make_rig();
		const r = await rig.p.exec("load no-such", rig.ctx);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("runtime");
	});

	test("pause sets time.scale to 0 and resume restores it", async () => {
		const rig = make_rig();
		rig.ctx.time.scale = 2.0;
		await rig.p.exec("pause", rig.ctx);
		expect(rig.ctx.time.scale).toBe(0);
		await rig.p.exec("resume", rig.ctx);
		expect(rig.ctx.time.scale).toBe(2.0);
	});

	test("tscale sets time.scale to provided number", async () => {
		const rig = make_rig();
		const r = await rig.p.exec("tscale 0.25", rig.ctx);
		expect(r.ok).toBe(true);
		expect(rig.ctx.time.scale).toBe(0.25);
	});

	test("bind adds a key trigger for an action", async () => {
		const rig = make_rig();
		const r = await rig.p.exec("bind jump Space", rig.ctx);
		expect(r.ok).toBe(true);
		const triggers = rig.ctx.input.bindings().digital.jump ?? [];
		expect(triggers.length).toBe(1);
		expect(triggers[0]).toEqual({ kind: "key", code: "Space" });
	});

	test("bind rejects unknown trigger format", async () => {
		const rig = make_rig();
		const r = await rig.p.exec("bind jump bogus", rig.ctx);
		expect(r.ok).toBe(false);
	});

	test("unbind removes all bindings for an action", async () => {
		const rig = make_rig();
		await rig.p.exec("bind jump Space", rig.ctx);
		await rig.p.exec("unbind jump", rig.ctx);
		expect(rig.ctx.input.bindings().digital.jump).toBeUndefined();
	});

	test("inspect formats entity components", async () => {
		const rig = make_rig();
		const r = await rig.p.exec("inspect 1", rig.ctx);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.value).toContain("#1");
			expect(r.value).toContain("pos");
		}
	});

	test("dbg toggles debug overlay flag", async () => {
		const rig = make_rig();
		expect(rig.ctx.debug.enabled()).toBe(true);
		await rig.p.exec("dbg off", rig.ctx);
		expect(rig.ctx.debug.enabled()).toBe(false);
		await rig.p.exec("dbg on", rig.ctx);
		expect(rig.ctx.debug.enabled()).toBe(true);
		await rig.p.exec("dbg", rig.ctx);
		expect(rig.ctx.debug.enabled()).toBe(false);
	});
});
