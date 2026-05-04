import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	default_prefs,
	empty_bindings,
	engine_store,
	type Bindings,
	type Snapshot,
} from "../../src/index.ts";

const make_snap = (tick: number): Snapshot => ({
	version: 1,
	meta: { tick, rng_state: 0, rng_seed: 1 },
	entities: [],
	resources: {},
});

describe("engine_store — three substores share corpus", () => {
	test("snapshots / bindings / prefs are independent slot namespaces", async () => {
		const s = engine_store({ backend: "mem" });
		await s.snapshots.save("slot-1", make_snap(10));
		await s.bindings.save("default", empty_bindings());
		await s.prefs.save("user", default_prefs);
		expect(await s.snapshots.has("slot-1")).toBe(true);
		expect(await s.bindings.has("default")).toBe(true);
		expect(await s.prefs.has("user")).toBe(true);
		expect(await s.snapshots.has("default")).toBe(false);
		expect(await s.bindings.has("slot-1")).toBe(false);
	});

	test("each substore round-trips independently", async () => {
		const s = engine_store({ backend: "mem" });
		const snap = make_snap(5);
		const b: Bindings = { ...empty_bindings(), digital: { jump: [{ kind: "key", code: "Space" }] } };
		const p = { ...default_prefs, time_scale: 0.5 };

		await s.snapshots.save("a", snap);
		await s.bindings.save("default", b);
		await s.prefs.save("u", p);

		const snap_load = await s.snapshots.load("a");
		const b_load = await s.bindings.load("default");
		const p_load = await s.prefs.load("u");

		expect(snap_load.ok).toBe(true);
		if (snap_load.ok) expect(snap_load.value.meta.tick).toBe(5);
		expect(b_load.ok).toBe(true);
		if (b_load.ok) expect(b_load.value.digital.jump?.[0]).toEqual({ kind: "key", code: "Space" });
		expect(p_load.ok).toBe(true);
		if (p_load.ok) expect(p_load.value.time_scale).toBe(0.5);
	});

	test("lineage works inside each substore", async () => {
		const s = engine_store({ backend: "mem" });
		const a = await s.snapshots.save("h", make_snap(1));
		await new Promise(r => setTimeout(r, 2));
		const b = await s.snapshots.save("h", make_snap(2));
		expect(a.ok && b.ok).toBe(true);
		if (!a.ok || !b.ok) return;
		expect(b.value.parent).not.toBeNull();
		expect(b.value.parent?.version).toBe(a.value.version);
	});

	test("corpus() returns the shared underlying instance", () => {
		const s = engine_store({ backend: "mem" });
		const c1 = s.corpus();
		const c2 = s.corpus();
		expect(c1).toBe(c2);
	});

	test("valid prefs round-trip; load returns parsed shape", async () => {
		const s = engine_store({ backend: "mem" });
		const r = await s.prefs.save("u", { debug_enabled: true, time_scale: 0.5, autosave: true });
		expect(r.ok).toBe(true);
		const loaded = await s.prefs.load("u");
		expect(loaded.ok).toBe(true);
		if (loaded.ok) expect(loaded.value).toEqual({ debug_enabled: true, time_scale: 0.5, autosave: true });
	});
});

describe("engine_store — file backend", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "forge-engine-"));
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	test("file backend persists across factory invocations", async () => {
		const a = engine_store({ backend: "file", dir });
		await a.snapshots.save("p", make_snap(11));

		const b = engine_store({ backend: "file", dir });
		const r = await b.snapshots.load("p");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value.meta.tick).toBe(11);
	});
});
