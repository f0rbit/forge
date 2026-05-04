import { ok, err, type Result } from "@f0rbit/corpus";
import type { EngineError } from "./errors.ts";
import { component, type Component, type Id, type World } from "./world.ts";
import { resource, type ResKey } from "./resources.ts";
import type { System } from "./schedule.ts";

export type AnimData = {
	atlas: string;
	sequence: string;
	frame: number;
	t: number;
	speed: number;
	loop: boolean;
	done: boolean;
};

export const anim_c: Component<AnimData> = component<AnimData>("anim");

export type AtlasFrame = { frame: string; ticks: number };
export type AtlasSequences = Record<string, readonly AtlasFrame[]>;
export type AtlasRegistry = Record<string, AtlasSequences>;

export const atlas_registry: ResKey<AtlasRegistry> = resource<AtlasRegistry>("forge.anim.atlas_registry");

export type AnimEvent =
	| { kind: "finished"; id: Id; sequence: string; tick: number }
	| { kind: "looped"; id: Id; sequence: string; tick: number };

export type AnimEventBuffer = { events: AnimEvent[] };

export const anim_events: ResKey<AnimEventBuffer> = resource<AnimEventBuffer>("forge.anim.events");

export type Anim = {
	advance: System;
	play: (w: World, id: Id, sequence: string, opts?: { speed?: number; loop?: boolean }) => Result<void, EngineError>;
	stop: (w: World, id: Id) => Result<void, EngineError>;
	playing: (w: World, id: Id) => boolean;
};

const lookup = (registry: AtlasRegistry | undefined, atlas: string, sequence: string): Result<readonly AtlasFrame[], EngineError> => {
	if (!registry) return err({ kind: "no_atlas_registered", atlas });
	const a = registry[atlas];
	if (!a) return err({ kind: "no_atlas_registered", atlas });
	const seq = a[sequence];
	if (!seq) return err({ kind: "unknown_sequence", atlas, sequence });
	return ok(seq);
};

export const anim = (): Anim => {
	const advance: System = (w, ctx) => {
		const reg_r = ctx.res.get(atlas_registry);
		const registry = reg_r.ok ? reg_r.value : undefined;

		const buf_r = ctx.res.get(anim_events);
		const buf = buf_r.ok ? buf_r.value : null;
		if (buf) buf.events.length = 0;

		for (const [id, data] of w.query([anim_c] as const)) {
			if (data.done) continue;
			const seq_r = lookup(registry, data.atlas, data.sequence);
			if (!seq_r.ok) continue;
			const seq = seq_r.value;
			if (seq.length === 0) continue;

			data.t += data.speed;
			while (true) {
				const cur = seq[data.frame] as AtlasFrame;
				if (data.t < cur.ticks) break;
				data.t -= cur.ticks;
				data.frame += 1;
				if (data.frame >= seq.length) {
					if (data.loop) {
						data.frame = 0;
						if (buf) buf.events.push({ kind: "looped", id, sequence: data.sequence, tick: ctx.time.tick });
					} else {
						data.frame = seq.length - 1;
						data.done = true;
						data.t = 0;
						if (buf) buf.events.push({ kind: "finished", id, sequence: data.sequence, tick: ctx.time.tick });
						break;
					}
				}
			}
		}
	};

	const play = (w: World, id: Id, sequence: string, opts?: { speed?: number; loop?: boolean }): Result<void, EngineError> => {
		const cur = w.get(id, anim_c);
		if (!cur.ok) return err(cur.error);
		const data = cur.value;
		const speed = opts?.speed ?? data.speed;
		const loop = opts?.loop ?? data.loop;
		return w.set(id, anim_c, { ...data, sequence, frame: 0, t: 0, speed, loop, done: false });
	};

	const stop = (w: World, id: Id): Result<void, EngineError> => {
		const cur = w.get(id, anim_c);
		if (!cur.ok) return err(cur.error);
		return w.set(id, anim_c, { ...cur.value, done: true });
	};

	const playing = (w: World, id: Id): boolean => {
		if (!w.has(id, anim_c)) return false;
		const r = w.get(id, anim_c);
		return r.ok && !r.value.done;
	};

	return { advance, play, stop, playing };
};
