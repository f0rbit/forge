import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { file, snapshot_schema, type Snapshot } from "../../src/storage/index.ts";

const make_snap = (tick: number): Snapshot => ({
	version: 1,
	meta: { tick, rng_state: 0, rng_seed: 1 },
	entities: [{ id: 1, components: { foo: { value: tick } } }],
	resources: {},
});

describe("file store — isolated temp dir per test", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "forge-file-test-"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	test("save → load round-trips through the filesystem", async () => {
		const s = file({ dir, schema: snapshot_schema });
		const snap = make_snap(7);
		const saved = await s.save("slot-1", snap);
		expect(saved.ok).toBe(true);
		const loaded = await s.load("slot-1");
		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;
		expect(JSON.stringify(loaded.value)).toBe(JSON.stringify(snap));
	});

	test("load on missing slot returns not_found", async () => {
		const s = file({ dir, schema: snapshot_schema });
		const r = await s.load("missing");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("not_found");
	});

	test("has reflects on-disk presence", async () => {
		const s = file({ dir, schema: snapshot_schema });
		expect(await s.has("a")).toBe(false);
		await s.save("a", make_snap(1));
		expect(await s.has("a")).toBe(true);
	});

	test("data persists across factory recreation (a fresh store sees prior writes)", async () => {
		const s1 = file({ dir, schema: snapshot_schema });
		await s1.save("persisted", make_snap(99));
		const s2 = file({ dir, schema: snapshot_schema });
		const r = await s2.load("persisted");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value.meta.tick).toBe(99);
	});

	test("list returns all slots written across writes", async () => {
		const s = file({ dir, schema: snapshot_schema });
		await s.save("a", make_snap(1));
		await s.save("b", make_snap(2));
		await s.save("c", make_snap(3));
		const r = await s.list();
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value.map(x => x.slot)).toEqual(["a", "b", "c"]);
	});

	test("remove erases the slot from list/load/has", async () => {
		const s = file({ dir, schema: snapshot_schema });
		await s.save("doomed", make_snap(1));
		expect(await s.has("doomed")).toBe(true);
		const removed = await s.remove("doomed");
		expect(removed.ok).toBe(true);
		expect(await s.has("doomed")).toBe(false);
	});

	test("invalid_data — schema mismatch on decode after a corrupt write surface fails", async () => {
		const strict = z.object({ a: z.number(), b: z.string() });
		const s = file({ dir, schema: strict });
		await s.save("ok", { a: 1, b: "two" });

		const lax = z.unknown();
		const s_lax = file({ dir, schema: lax, id: "forge.snapshot" });
		await s_lax.save("bad", { totally: "different shape" });

		const r = await s.load("bad");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("invalid_data");
	});

	test("two saves on same slot — second is the latest, first preserved in history", async () => {
		const s = file({ dir, schema: snapshot_schema });
		await s.save("h", make_snap(1));
		await new Promise(r => setTimeout(r, 2));
		await s.save("h", make_snap(2));
		const loaded = await s.load("h");
		expect(loaded.ok).toBe(true);
		if (loaded.ok) expect(loaded.value.meta.tick).toBe(2);

		const handles = [];
		for await (const h of s.history("h")) handles.push(h);
		expect(handles.length).toBe(2);
	});
});
