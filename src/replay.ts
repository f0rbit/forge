import { ok, err, try_catch, type Result } from "@f0rbit/corpus";
import { z } from "zod";
import type { Input } from "./input/input.ts";
import type { Ctx } from "./schedule.ts";

export type ActionEvent =
	| { kind: "press"; action: string; tick: number }
	| { kind: "release"; action: string; tick: number }
	| { kind: "axis"; action: string; value: number; tick: number };

export type ReplayDoc = {
	version: 1;
	seed: number;
	fixed_dt: number;
	frames: ReadonlyArray<{ tick: number; events: readonly ActionEvent[] }>;
};

const action_event_schema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("press"), action: z.string(), tick: z.number().int().nonnegative() }),
	z.object({ kind: z.literal("release"), action: z.string(), tick: z.number().int().nonnegative() }),
	z.object({ kind: z.literal("axis"), action: z.string(), value: z.number(), tick: z.number().int().nonnegative() }),
]);

export const replay_schema = z.object({
	version: z.literal(1),
	seed: z.number().int(),
	fixed_dt: z.number().positive(),
	frames: z.array(z.object({ tick: z.number().int().nonnegative(), events: z.array(action_event_schema) })),
});

export type ReplayError =
	| { kind: "replay_parse_error"; message: string }
	| { kind: "replay_validation_error"; issues: readonly string[] };

export type Recorder = {
	stop: () => ReplayDoc;
	dump: () => ReplayDoc;
};

export type Player = {
	complete: () => boolean;
	detach: () => void;
};

const epsilon = 1e-6;

const same_axis = (a: number, b: number): boolean => Math.abs(a - b) < epsilon;

type RecordRawOpts = { seed: number; fixed_dt: number; get_tick: () => number };
type RecordCtxOpts = { seed?: number };

const is_ctx = (x: Ctx | RecordRawOpts): x is Ctx =>
	typeof (x as Ctx).time === "object" && typeof (x as Ctx).rng === "object";

function record(input: Input, ctx: Ctx, opts?: RecordCtxOpts): Recorder;
function record(input: Input, opts: RecordRawOpts): Recorder;
function record(i: Input, second: Ctx | RecordRawOpts, third?: RecordCtxOpts): Recorder {
	const opts: RecordRawOpts = is_ctx(second)
		? {
			seed: third?.seed ?? second.rng.seed,
			fixed_dt: second.time.fixed_dt,
			get_tick: () => second.time.tick,
		}
		: second;
	const frames = new Map<number, ActionEvent[]>();
	const last_pressed = new Map<string, boolean>();
	const last_axis = new Map<string, number>();
	let stopped = false;

	const push = (tick: number, ev: ActionEvent): void => {
		const existing = frames.get(tick);
		if (existing) existing.push(ev);
		else frames.set(tick, [ev]);
	};

	const off = i.on_advance(() => {
		if (stopped) return;
		const tick = opts.get_tick();
		const bindings = i.bindings();
		const seen = new Set<string>();
		for (const a of Object.keys(bindings.digital)) seen.add(a);
		for (const a of Object.keys(bindings.axes)) seen.add(a);

		for (const action of seen) {
			const has_axis = bindings.axes[action] !== undefined;
			if (has_axis) {
				const v = i.axis(action);
				const prev = last_axis.get(action) ?? 0;
				if (!same_axis(v, prev)) {
					push(tick, { kind: "axis", action, value: v, tick });
					last_axis.set(action, v);
				}
			} else {
				const cur = i.pressed(action);
				const prev = last_pressed.get(action) ?? false;
				if (cur && !prev) {
					push(tick, { kind: "press", action, tick });
					last_pressed.set(action, true);
				} else if (!cur && prev) {
					push(tick, { kind: "release", action, tick });
					last_pressed.set(action, false);
				}
			}
		}
	});

	const dump = (): ReplayDoc => {
		const sorted = Array.from(frames.entries()).sort((a, b) => a[0] - b[0]);
		return {
			version: 1,
			seed: opts.seed,
			fixed_dt: opts.fixed_dt,
			frames: sorted.map(([tick, events]) => ({ tick, events: events.slice() })),
		};
	};

	const stop = (): ReplayDoc => {
		stopped = true;
		off();
		return dump();
	};

	return { stop, dump };
}

const play = (doc: ReplayDoc, i: Input, get_tick: () => number): Player => {
	const by_tick = new Map<number, readonly ActionEvent[]>();
	let max_tick = -1;
	for (const f of doc.frames) {
		by_tick.set(f.tick, f.events);
		if (f.tick > max_tick) max_tick = f.tick;
	}

	let last_drained = -1;

	const off = i.on_pre_advance(() => {
		const tick = get_tick();
		last_drained = tick;
		const events = by_tick.get(tick);
		if (events) i.inject_actions(events);
	});

	return {
		complete: () => last_drained >= max_tick,
		detach: off,
	};
};

const save = (doc: ReplayDoc): string => JSON.stringify(doc);

const load = (json: string): Result<ReplayDoc, ReplayError> => {
	const parsed = try_catch<unknown, ReplayError>(
		() => JSON.parse(json),
		e => ({ kind: "replay_parse_error", message: e instanceof Error ? e.message : String(e) }),
	);
	if (!parsed.ok) return parsed;
	const r = replay_schema.safeParse(parsed.value);
	if (!r.success) {
		const issues = r.error.issues.map(i => `${i.path.join(".") || "<root>"}: ${i.message}`);
		return err({ kind: "replay_validation_error", issues });
	}
	return ok(r.data as ReplayDoc);
};

export const replay = {
	record,
	play,
	save,
	load,
};
