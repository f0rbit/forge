import {
	create_corpus,
	create_memory_backend,
	define_store,
	json_codec,
	ok,
	err,
	type Backend,
	type Corpus,
	type CorpusError,
	type Result,
	type SnapshotMeta,
	type Store as CorpusStore,
} from "@f0rbit/corpus";
import { create_file_backend } from "@f0rbit/corpus/file";
import { z } from "zod";
import type { Bindings } from "../input/bindings.ts";
import { snapshot_schema, type Snapshot } from "../snapshot.ts";
import type { SaveHandle, SaveSlot, Slot, Store, StoreError } from "./types.ts";

const SLOT_PREFIX = "slot:";
const slot_tag = (slot: Slot): string => `${SLOT_PREFIX}${slot}`;

const trigger_schema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("key"), code: z.string() }),
	z.object({ kind: z.literal("mouse"), button: z.union([z.literal(0), z.literal(1), z.literal(2)]) }),
	z.object({ kind: z.literal("pad.button"), button: z.number().int().nonnegative(), pad: z.number().int().optional() }),
	z.object({
		kind: z.literal("pad.axis"),
		axis: z.number().int().nonnegative(),
		pad: z.number().int().optional(),
		threshold: z.number().optional(),
		sign: z.union([z.literal(1), z.literal(-1)]).optional(),
	}),
]);

const axis_binding_schema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("key.pair"), positive: z.string(), negative: z.string() }),
	z.object({
		kind: z.literal("pad.axis"),
		axis: z.number().int().nonnegative(),
		pad: z.number().int().optional(),
		scale: z.number().optional(),
		deadzone: z.number().optional(),
		invert: z.boolean().optional(),
	}),
	z.object({
		kind: z.literal("pad.button.pair"),
		positive: z.number().int().nonnegative(),
		negative: z.number().int().nonnegative(),
		pad: z.number().int().optional(),
	}),
]);

export const bindings_schema: z.ZodType<Bindings> = z.object({
	digital: z.record(z.string(), z.array(trigger_schema)),
	axes: z.record(z.string(), z.array(axis_binding_schema)),
	deadzone: z.number(),
});

export const prefs_schema = z.object({
	debug_enabled: z.boolean(),
	time_scale: z.number(),
	autosave: z.boolean(),
});

export type Prefs = z.infer<typeof prefs_schema>;

export const default_prefs: Prefs = {
	debug_enabled: false,
	time_scale: 1,
	autosave: false,
};

export type EngineStore = {
	snapshots: Store<Snapshot>;
	bindings: Store<Bindings>;
	prefs: Store<Prefs>;
	corpus: () => Corpus;
};

export type EngineStoreOpts =
	| { backend?: "mem"; id_prefix?: string }
	| { backend: "file"; dir: string; id_prefix?: string };

const map_corpus_err = (operation: string) => (e: CorpusError): StoreError => {
	if (e.kind === "not_found") return { kind: "not_found", slot: "" };
	if (e.kind === "decode_error") return { kind: "invalid_data", issues: [e.cause.message] };
	if (e.kind === "encode_error") return { kind: "serialisation_failed", cause: e.cause.message };
	if (e.kind === "validation_error") return { kind: "invalid_data", issues: [e.message] };
	if (e.kind === "storage_error") return { kind: "backend_error", operation, cause: e.cause.message };
	if (e.kind === "hash_mismatch") return { kind: "invalid_data", issues: [`hash mismatch: expected ${e.expected}, got ${e.actual}`] };
	if (e.kind === "already_exists") return { kind: "backend_error", operation, cause: "already exists" };
	if (e.kind === "invalid_config") return { kind: "backend_error", operation, cause: e.message };
	if (e.kind === "observation_not_found") return { kind: "not_found", slot: "" };
	return { kind: "backend_error", operation, cause: "unknown corpus error" };
};

const meta_to_handle = (slot: Slot, meta: SnapshotMeta, parent: SaveHandle | null): SaveHandle => ({
	slot,
	version: meta.version,
	content_hash: meta.content_hash,
	created_at: meta.created_at,
	parent,
});

const collect_slot_metas = async (cs: CorpusStore<unknown>, slot: Slot): Promise<SnapshotMeta[]> => {
	const tag = slot_tag(slot);
	const metas: SnapshotMeta[] = [];
	for await (const m of cs.list({ tags: [tag] })) metas.push(m);
	return metas.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
};

const latest_for_slot = async (cs: CorpusStore<unknown>, slot: Slot): Promise<SnapshotMeta | null> => {
	const metas = await collect_slot_metas(cs, slot);
	return metas[0] ?? null;
};

const make_substore = <T>(cs: CorpusStore<T>, id: string): Store<T> => {
	const opaque = cs as unknown as CorpusStore<unknown>;
	const save: Store<T>["save"] = async (slot, value) => {
		const prev = await latest_for_slot(opaque, slot);
		const parents = prev ? [{ store_id: id, version: prev.version }] : [];
		const result = await cs.put(value, { tags: [slot_tag(slot)], parents });
		if (!result.ok) return err(map_corpus_err("save")(result.error));
		const parent_handle = prev ? meta_to_handle(slot, prev, null) : null;
		return ok(meta_to_handle(slot, result.value, parent_handle));
	};
	const load: Store<T>["load"] = async slot => {
		const latest = await latest_for_slot(opaque, slot);
		if (!latest) return err({ kind: "not_found", slot });
		const result = await cs.get(latest.version);
		if (!result.ok) {
			const mapped = map_corpus_err("load")(result.error);
			if (mapped.kind === "not_found") return err({ kind: "not_found", slot });
			return err(mapped);
		}
		return ok(result.value.data);
	};
	const list: Store<T>["list"] = async () => {
		const by_slot = new Map<Slot, SnapshotMeta>();
		for await (const m of cs.list()) {
			const tag = m.tags?.find(t => t.startsWith(SLOT_PREFIX));
			if (!tag) continue;
			const slot = tag.slice(SLOT_PREFIX.length);
			const existing = by_slot.get(slot);
			if (!existing || existing.created_at < m.created_at) by_slot.set(slot, m);
		}
		const slots: SaveSlot[] = Array.from(by_slot.entries())
			.map(([slot, meta]) => ({ slot, latest: meta_to_handle(slot, meta, null) }))
			.sort((a, b) => a.slot.localeCompare(b.slot));
		return ok(slots);
	};
	const remove: Store<T>["remove"] = async slot => {
		const metas = await collect_slot_metas(opaque, slot);
		if (metas.length === 0) return err({ kind: "not_found", slot });
		for (const m of metas) {
			const r = await cs.delete(m.version);
			if (!r.ok) return err(map_corpus_err("remove")(r.error));
		}
		return ok(undefined);
	};
	const has: Store<T>["has"] = async slot => {
		const latest = await latest_for_slot(opaque, slot);
		return latest !== null;
	};
	const history: Store<T>["history"] = async function* (slot) {
		const metas = await collect_slot_metas(opaque, slot);
		let parent: SaveHandle | null = null;
		for (const m of metas.slice().reverse()) {
			const handle = meta_to_handle(slot, m, parent);
			parent = handle;
			yield handle;
		}
	};
	return { save, load, list, remove, has, history };
};

const pick_backend = (opts?: EngineStoreOpts): Backend => {
	if (opts && opts.backend === "file") return create_file_backend({ base_path: opts.dir });
	return create_memory_backend();
};

export const engine_store = (opts?: EngineStoreOpts): EngineStore => {
	const prefix = opts?.id_prefix ?? "forge";
	const snapshots_id = `${prefix}.snapshots`;
	const bindings_id = `${prefix}.bindings`;
	const prefs_id = `${prefix}.prefs`;

	const backend = pick_backend(opts);

	const corpus = create_corpus()
		.with_backend(backend)
		.with_store(define_store(snapshots_id, json_codec(snapshot_schema)))
		.with_store(define_store(bindings_id, json_codec(bindings_schema)))
		.with_store(define_store(prefs_id, json_codec(prefs_schema)))
		.build();

	const snapshots_cs = corpus.stores[snapshots_id] as CorpusStore<Snapshot>;
	const bindings_cs = corpus.stores[bindings_id] as CorpusStore<Bindings>;
	const prefs_cs = corpus.stores[prefs_id] as CorpusStore<Prefs>;

	return {
		snapshots: make_substore(snapshots_cs, snapshots_id),
		bindings: make_substore(bindings_cs, bindings_id),
		prefs: make_substore(prefs_cs, prefs_id),
		corpus: () => corpus as unknown as Corpus,
	};
};
