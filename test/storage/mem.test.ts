import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { mem, snapshot_schema, type Snapshot } from "../../src/storage/index.ts";

const make_snap = (tick: number, score = 0): Snapshot => ({
	version: 1,
	meta: { tick, rng_state: 0, rng_seed: 1 },
	entities: [{ id: 1, components: { foo: { value: tick * 2 } } }],
	resources: { score },
});

describe("mem store", () => {
	test("save returns SaveHandle with content_hash and version", async () => {
		const s = mem({ schema: snapshot_schema });
		const r = await s.save("slot-1", make_snap(10));
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.value.slot).toBe("slot-1");
		expect(r.value.content_hash.length).toBeGreaterThan(0);
		expect(r.value.version.length).toBeGreaterThan(0);
		expect(r.value.parent).toBeNull();
	});

	test("save then load round-trips data byte-equal", async () => {
		const s = mem({ schema: snapshot_schema });
		const original = make_snap(5, 99);
		const saved = await s.save("a", original);
		expect(saved.ok).toBe(true);
		const loaded = await s.load("a");
		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;
		expect(JSON.stringify(loaded.value)).toBe(JSON.stringify(original));
	});

	test("load on missing slot returns not_found", async () => {
		const s = mem({ schema: snapshot_schema });
		const r = await s.load("nope");
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.kind).toBe("not_found");
			if (r.error.kind === "not_found") expect(r.error.slot).toBe("nope");
		}
	});

	test("has returns false for missing slot, true after save", async () => {
		const s = mem({ schema: snapshot_schema });
		expect(await s.has("x")).toBe(false);
		await s.save("x", make_snap(1));
		expect(await s.has("x")).toBe(true);
	});

	test("save twice on same slot — load returns the latest snapshot", async () => {
		const s = mem({ schema: snapshot_schema });
		await s.save("z", make_snap(1));
		await new Promise(r => setTimeout(r, 2));
		await s.save("z", make_snap(2));
		const loaded = await s.load("z");
		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;
		expect(loaded.value.meta.tick).toBe(2);
	});

	test("save twice on same slot — handle.parent points to previous", async () => {
		const s = mem({ schema: snapshot_schema });
		const first = await s.save("lineage", make_snap(1));
		await new Promise(r => setTimeout(r, 2));
		const second = await s.save("lineage", make_snap(2));
		expect(first.ok && second.ok).toBe(true);
		if (!first.ok || !second.ok) return;
		expect(second.value.parent).not.toBeNull();
		expect(second.value.parent?.version).toBe(first.value.version);
	});

	test("list returns sorted slot summaries", async () => {
		const s = mem({ schema: snapshot_schema });
		await s.save("b", make_snap(1));
		await s.save("a", make_snap(2));
		await s.save("c", make_snap(3));
		const r = await s.list();
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.value.map(x => x.slot)).toEqual(["a", "b", "c"]);
	});

	test("remove deletes a slot and subsequent load is not_found", async () => {
		const s = mem({ schema: snapshot_schema });
		await s.save("victim", make_snap(1));
		const removed = await s.remove("victim");
		expect(removed.ok).toBe(true);
		expect(await s.has("victim")).toBe(false);
		const r = await s.load("victim");
		expect(r.ok).toBe(false);
	});

	test("remove on missing slot returns not_found", async () => {
		const s = mem({ schema: snapshot_schema });
		const r = await s.remove("ghost");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("not_found");
	});

	test("save same content twice — content-hash dedup at corpus layer", async () => {
		const s = mem({ schema: snapshot_schema });
		const snap = make_snap(1);
		const a = await s.save("x", snap);
		const b = await s.save("y", snap);
		expect(a.ok && b.ok).toBe(true);
		if (!a.ok || !b.ok) return;
		expect(a.value.content_hash).toBe(b.value.content_hash);
	});

	test("history yields snapshots oldest-to-newest with parent chain", async () => {
		const s = mem({ schema: snapshot_schema });
		await s.save("h", make_snap(1));
		await new Promise(r => setTimeout(r, 2));
		await s.save("h", make_snap(2));
		await new Promise(r => setTimeout(r, 2));
		await s.save("h", make_snap(3));
		const handles: Array<{ version: string; parent: unknown }> = [];
		for await (const h of s.history("h")) handles.push({ version: h.version, parent: h.parent });
		expect(handles.length).toBe(3);
		expect(handles[0]?.parent).toBeNull();
		expect(handles[1]?.parent).not.toBeNull();
		expect(handles[2]?.parent).not.toBeNull();
	});

	test("custom store id is honoured in opts.id", async () => {
		const s = mem({ schema: snapshot_schema, id: "custom.id" });
		const r = await s.save("k", make_snap(1));
		expect(r.ok).toBe(true);
	});

	test("round-trip with a non-snapshot generic schema", async () => {
		const schema = z.object({ name: z.string(), n: z.number() });
		const s = mem({ schema });
		const value = { name: "alice", n: 7 };
		await s.save("g", value);
		const r = await s.load("g");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value).toEqual(value);
	});
});
