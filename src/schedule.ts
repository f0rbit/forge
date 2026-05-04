import type { World } from "./world.ts";

export type Stage = "startup" | "pre" | "update" | "post" | "render" | (string & {});

export type Ctx = {
	time: import("./time.ts").Time;
	rng: import("./rng.ts").Rng;
	res: import("./resources.ts").Resources;
};

export type System = (w: World, ctx: Ctx) => void;

type Entry = { name: string; fn: System };

export type Schedule = {
	add: (stage: Stage, system: System, name?: string) => Schedule;
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
			for (const stage of default_order) {
				if (stage === "startup") continue;
				api.run(stage, w, ctx);
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
