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

export type { EngineError } from "./errors.ts";
