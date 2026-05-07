import type { World } from "./world.ts";

export type Stage = "startup" | "pre" | "update" | "post" | "render" | (string & {});

export type Ctx = {
	time: import("./time.ts").Time;
	rng: import("./rng.ts").Rng;
	res: import("./resources.ts").Resources;
	input: import("./input/input.ts").Input;
	debug: import("./debug/debug.ts").Debug;
	palette: import("./palette/palette.ts").Palette;
	store?: import("./storage/engine-store.ts").EngineStore;
};

export type System = (w: World, ctx: Ctx) => void;

type Entry = { name: string; fn: System };

export type PeriodicOpts = { every: number; phase?: number };

export type Schedule = {
	add: (stage: Stage, system: System, name?: string) => Schedule;
	add_periodic: (stage: Stage, system: System, opts: PeriodicOpts, name?: string) => Schedule;
	remove: (name: string) => Schedule;
	tick: (w: World, ctx: Ctx) => void;
	run: (stage: Stage, w: World, ctx: Ctx) => void;
	stages: () => readonly Stage[];
};

const default_order: readonly Stage[] = ["startup", "pre", "update", "post", "render"];

export const schedule = (): Schedule => {
	const by_stage = new Map<Stage, Entry[]>();
	let startup_done = false;
	let auto_id = 0;

	const list = (stage: Stage): Entry[] => {
		const existing = by_stage.get(stage);
		if (existing) return existing;
		const fresh: Entry[] = [];
		by_stage.set(stage, fresh);
		return fresh;
	};

	const api: Schedule = {
		add: (stage, system, name) => {
			const entry: Entry = { name: name ?? `__sys_${auto_id++}`, fn: system };
			list(stage).push(entry);
			return api;
		},
		add_periodic: (stage, system, opts, name) => {
			if (!Number.isFinite(opts.every) || opts.every < 1 || !Number.isInteger(opts.every)) {
				throw new Error(`[forge] schedule.add_periodic: 'every' must be a positive integer (>= 1), got ${opts.every}`); // non-deterministic-ok: programmer-error guard
			}
			const phase = opts.phase ?? 0;
			if (!Number.isFinite(phase) || phase < 0 || !Number.isInteger(phase)) {
				throw new Error(`[forge] schedule.add_periodic: 'phase' must be a non-negative integer, got ${phase}`); // non-deterministic-ok: programmer-error guard
			}
			const every = opts.every;
			const gated: System = (w, ctx) => {
				if (ctx.time.tick % every === phase % every) system(w, ctx);
			};
			const entry: Entry = { name: name ?? `__sys_${auto_id++}`, fn: gated };
			list(stage).push(entry);
			return api;
		},
		remove: name => {
			for (const entries of by_stage.values()) {
				const idx = entries.findIndex(e => e.name === name);
				if (idx !== -1) entries.splice(idx, 1);
			}
			return api;
		},
		run: (stage, w, ctx) => {
			const entries = by_stage.get(stage);
			if (!entries) return;
			for (const e of entries) e.fn(w, ctx);
		},
		tick: (w, ctx) => {
			if (!startup_done) {
				api.run("startup", w, ctx);
				startup_done = true;
			}
			ctx.input.advance(w, ctx);
			for (const stage of default_order) {
				if (stage === "startup") continue;
				api.run(stage, w, ctx);
				if (stage === "render") ctx.debug.frame();
			}
		},
		stages: () => {
			const seen = new Set<Stage>(default_order);
			for (const s of by_stage.keys()) seen.add(s);
			return Array.from(seen);
		},
	};
	return api;
};
