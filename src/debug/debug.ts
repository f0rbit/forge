import type { Vec2 } from "../math.ts";
import { internal, type Id, type World } from "../world.ts";
import type { Color, DebugCmd, DebugStats, Inspection, Pin, PinKind } from "./types.ts";

const DEFAULT_COLOR: Color = "white";
const DEFAULT_TTL = 60;

const DEV = (() => {
	const g = globalThis as { __DEV__?: boolean };
	if (typeof g.__DEV__ === "boolean") return g.__DEV__;
	const proc = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
	return proc?.env?.NODE_ENV !== "production";
})();

export type Debug = {
	enabled: () => boolean;
	toggle: () => void;
	on: () => void;
	off: () => void;
	line: (a: Vec2, b: Vec2, color?: Color) => void;
	circle: (center: Vec2, r: number, color?: Color) => void;
	rect: (x: number, y: number, w: number, h: number, color?: Color) => void;
	text: (pos: Vec2, text: string, color?: Color) => void;
	pin: (id: Id, opts: { kind: PinKind; data: unknown; ttl?: number }) => void;
	unpin: (id: Id, kind?: PinKind) => void;
	pinned: (id?: Id) => readonly Pin[];
	counter: (name: string, value: number | string) => void;
	counters: () => Readonly<Record<string, number | string>>;
	stats: () => DebugStats;
	tick_stats: (w: World, time: { tick: number; scale?: number }, fps?: number) => void;
	timing: (system: string, micros: number) => void;
	select: (id: Id | null) => void;
	selected: () => Id | null;
	inspect: (w: World, id: Id) => Inspection;
	frame: () => readonly DebugCmd[];
};

export type DebugOpts = {
	enabled?: boolean;
	dev?: boolean;
};

export const debug = (opts?: DebugOpts): Debug => {
	let on = opts?.enabled ?? true;
	const allowed = opts?.dev ?? DEV;

	const buffer: DebugCmd[] = [];
	const pins = new Map<Id, Map<PinKind, Pin>>();
	const counter_state: Record<string, number | string> = {};
	const stats_state: DebugStats = { tick: 0, entities: 0, fps: 0, tscale: 1, system_us: {} };
	let selected_id: Id | null = null;
	let cur_tick = 0;

	const can_write = (): boolean => allowed && on;

	const push = (cmd: DebugCmd): void => {
		buffer.push(cmd);
	};

	const expire_pins = (): void => {
		for (const [eid, kinds] of pins) {
			for (const [kind, pin] of kinds) {
				if (pin.ttl <= 0) continue;
				if (cur_tick - pin.added_tick >= pin.ttl) kinds.delete(kind);
			}
			if (kinds.size === 0) pins.delete(eid);
		}
	};

	return {
		enabled: () => on,
		toggle: () => {
			on = !on;
		},
		on: () => {
			on = true;
		},
		off: () => {
			on = false;
		},
		line: (a, b, color) => {
			if (!can_write()) return;
			push({ kind: "line", a, b, color: color ?? DEFAULT_COLOR });
		},
		circle: (center, r, color) => {
			if (!can_write()) return;
			push({ kind: "circle", center, r, color: color ?? DEFAULT_COLOR });
		},
		rect: (x, y, w, h, color) => {
			if (!can_write()) return;
			push({ kind: "rect", x, y, w, h, color: color ?? DEFAULT_COLOR });
		},
		text: (pos, text, color) => {
			if (!can_write()) return;
			push({ kind: "text", pos, text, color: color ?? DEFAULT_COLOR });
		},
		pin: (id, p) => {
			if (!can_write()) return;
			const ttl = p.ttl ?? DEFAULT_TTL;
			const bucket = pins.get(id) ?? new Map<PinKind, Pin>();
			bucket.set(p.kind, { id, kind: p.kind, data: p.data, ttl, added_tick: cur_tick });
			pins.set(id, bucket);
		},
		unpin: (id, kind) => {
			const bucket = pins.get(id);
			if (!bucket) return;
			if (kind === undefined) {
				pins.delete(id);
				return;
			}
			bucket.delete(kind);
			if (bucket.size === 0) pins.delete(id);
		},
		pinned: id => {
			if (id === undefined) {
				const out: Pin[] = [];
				for (const bucket of pins.values()) out.push(...bucket.values());
				return out;
			}
			const bucket = pins.get(id);
			return bucket ? Array.from(bucket.values()) : [];
		},
		counter: (name, value) => {
			if (!can_write()) return;
			counter_state[name] = value;
		},
		counters: () => counter_state,
		stats: () => stats_state,
		tick_stats: (w, t, fps) => {
			cur_tick = t.tick;
			stats_state.tick = t.tick;
			stats_state.entities = w.count();
			if (t.scale !== undefined) stats_state.tscale = t.scale;
			if (fps !== undefined) stats_state.fps = fps;
			expire_pins();
		},
		timing: (system, micros) => {
			if (!can_write()) return;
			stats_state.system_us[system] = micros;
		},
		select: id => {
			selected_id = id;
		},
		selected: () => selected_id,
		inspect: (w, id) => {
			const wi = w[internal];
			const cs = wi.components_of(id);
			const components = cs.map(c => {
				const r = w.get(id, c);
				return { name: c.name, data: r.ok ? r.value : undefined };
			});
			return { entity: id, components };
		},
		frame: () => {
			const drained = buffer.slice();
			buffer.length = 0;
			return drained;
		},
	};
};

export const debug_noop = (): Debug => debug({ enabled: false, dev: false });

export const is_dev = (): boolean => DEV;
