import {
	create_corpus,
	define_store,
	json_codec,
	ok,
	err,
	type Backend,
	type CorpusError,
	type Result,
	type SnapshotMeta,
	type Store as CorpusStore,
} from "@f0rbit/corpus";
import { z } from "zod";
import type { Slot, SaveHandle, SaveSlot, StoreError, Store } from "./types.ts";

export type StoreOpts<T> = {
	backend: Backend;
	id?: string;
	schema: z.ZodType<T>;
};

const SLOT_PREFIX = "slot:";
const slot_tag = (slot: Slot): string => `${SLOT_PREFIX}${slot}`;

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

export const store = <T>(opts: StoreOpts<T>): Store<T> => {
	const id = opts.id ?? "forge.snapshot";
	const definition = define_store(id, json_codec(opts.schema));
	const corpus = create_corpus().with_backend(opts.backend).with_store(definition).build();
	const cs = corpus.stores[id] as CorpusStore<T>;

	const save: Store<T>["save"] = async (slot, value) => {
		const prev = await latest_for_slot(cs as unknown as CorpusStore<unknown>, slot);
		const parents = prev ? [{ store_id: id, version: prev.version }] : [];
		const result = await cs.put(value, { tags: [slot_tag(slot)], parents });
		if (!result.ok) return err(map_corpus_err("save")(result.error));
		const parent_handle = prev ? meta_to_handle(slot, prev, null) : null;
		return ok(meta_to_handle(slot, result.value, parent_handle));
	};

	const load: Store<T>["load"] = async slot => {
		const latest = await latest_for_slot(cs as unknown as CorpusStore<unknown>, slot);
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
		const metas = await collect_slot_metas(cs as unknown as CorpusStore<unknown>, slot);
		if (metas.length === 0) return err({ kind: "not_found", slot });
		for (const m of metas) {
			const r = await cs.delete(m.version);
			if (!r.ok) return err(map_corpus_err("remove")(r.error));
		}
		return ok(undefined);
	};

	const has: Store<T>["has"] = async slot => {
		const latest = await latest_for_slot(cs as unknown as CorpusStore<unknown>, slot);
		return latest !== null;
	};

	const history: Store<T>["history"] = async function* (slot) {
		const metas = await collect_slot_metas(cs as unknown as CorpusStore<unknown>, slot);
		let parent: SaveHandle | null = null;
		for (const m of metas.slice().reverse()) {
			const handle = meta_to_handle(slot, m, parent);
			parent = handle;
			yield handle;
		}
	};

	return { save, load, list, remove, has, history };
};
