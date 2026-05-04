export const VERSION = "0.0.1" as const;

export { world, component, internal } from "./world.ts";
export type { World, Component, Id, Query, QueryOpts, ComponentTuple, WorldInternal } from "./world.ts";

export { schedule } from "./schedule.ts";
export type { Schedule, Stage, System, Ctx } from "./schedule.ts";

export { time } from "./time.ts";
export type { Time } from "./time.ts";

export { rng } from "./rng.ts";
export type { Rng } from "./rng.ts";

export { resources, resource } from "./resources.ts";
export type { Resources, ResKey } from "./resources.ts";

export { anim, anim_c, atlas_registry, anim_events } from "./anim.ts";
export type { Anim, AnimData, AnimEvent, AnimEventBuffer, AtlasFrame, AtlasRegistry, AtlasSequences } from "./anim.ts";

export { input, noop_source, scripted, ticked, empty_bindings, merge_bindings } from "./input/index.ts";
export type {
	Input,
	ActionState,
	RawInput,
	InputSource,
	PadIndex,
	Bindings,
	Trigger,
	AxisBinding,
	Action,
} from "./input/index.ts";

export { replay } from "./replay.ts";
export type { ReplayDoc, ActionEvent, ReplayError, Recorder, Player } from "./replay.ts";

export { snapshotter, snapshot_schema } from "./snapshot.ts";
export type { Snapshot, SnapshotMeta, EntitySnap, Snapshotter, TakeOpts, RestoreOpts } from "./snapshot.ts";

export { mem, file, store, save, load } from "./storage/index.ts";
export type { Store, Slot, SaveHandle, SaveSlot, StoreError, MemOpts, FileOpts, StoreOpts, SaveError } from "./storage/index.ts";

export { debug_noop } from "./debug-stub.ts";
export type { Debug } from "./debug-stub.ts";

export { palette_noop } from "./palette-stub.ts";
export type { Palette } from "./palette-stub.ts";

export type { EngineError } from "./errors.ts";
