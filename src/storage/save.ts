import { ok, err, type Result } from "@f0rbit/corpus";
import type { World } from "../world.ts";
import type { Snapshotter, Snapshot, TakeOpts, RestoreOpts } from "../snapshot.ts";
import type { Store, Slot, SaveHandle, StoreError } from "./types.ts";
import type { EngineError } from "../errors.ts";

export type SaveError =
	| { kind: "snapshot"; cause: EngineError }
	| { kind: "store"; cause: StoreError };

export const save = async (
	w: World,
	snap: Snapshotter,
	store: Store<Snapshot>,
	slot: Slot,
	opts: TakeOpts,
): Promise<Result<SaveHandle, SaveError>> => {
	const taken = snap.take(w, opts);
	if (!taken.ok) return err({ kind: "snapshot", cause: taken.error });
	const saved = await store.save(slot, taken.value);
	if (!saved.ok) return err({ kind: "store", cause: saved.error });
	return ok(saved.value);
};

export const load = async (
	w: World,
	snap: Snapshotter,
	store: Store<Snapshot>,
	slot: Slot,
	opts: RestoreOpts,
): Promise<Result<Snapshot, SaveError>> => {
	const loaded = await store.load(slot);
	if (!loaded.ok) return err({ kind: "store", cause: loaded.error });
	const restored = snap.restore(w, loaded.value, opts);
	if (!restored.ok) return err({ kind: "snapshot", cause: restored.error });
	return ok(loaded.value);
};
