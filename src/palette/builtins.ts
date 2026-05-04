import { ok, err } from "@f0rbit/corpus";
import { z } from "zod";
import type { World, Id } from "../world.ts";
import type { Snapshot, Snapshotter } from "../snapshot.ts";
import type { Store, Slot } from "../storage/types.ts";
import type { Trigger } from "../input/bindings.ts";
import type { Command } from "./types.ts";

export type BuiltinDeps = {
	world: World;
	snapshotter: Snapshotter;
	snapshots: Store<Snapshot>;
};

const slot_args = z.tuple([z.string()]);
const number_args = z.tuple([z.number()]);
const empty_args = z.tuple([]);
const action_args = z.tuple([z.string()]);
const action_key_args = z.tuple([z.string(), z.string()]);
const id_args = z.tuple([z.number().int().nonnegative()]);
const dbg_args = z.union([
	z.tuple([]),
	z.tuple([z.union([z.boolean(), z.literal("on"), z.literal("off"), z.literal("toggle")])]),
]);

type DbgArgs = z.infer<typeof dbg_args>;

const save_cmd = (deps: BuiltinDeps): Command<readonly [Slot]> => ({
	name: "save",
	desc: "save current world to a slot",
	args: slot_args,
	run: async ([slot], ctx) => {
		const taken = deps.snapshotter.take(deps.world, { time: ctx.time, rng: ctx.rng, res: ctx.res });
		if (!taken.ok) return err({ kind: "runtime", message: `snapshot failed: ${taken.error.kind}` });
		const saved = await deps.snapshots.save(slot, taken.value);
		if (!saved.ok) return err({ kind: "runtime", message: `save failed: ${saved.error.kind}` });
		return ok(`saved to slot:${slot}`);
	},
});

const load_cmd = (deps: BuiltinDeps): Command<readonly [Slot]> => ({
	name: "load",
	desc: "load world from a slot",
	args: slot_args,
	run: async ([slot], ctx) => {
		const loaded = await deps.snapshots.load(slot);
		if (!loaded.ok) {
			if (loaded.error.kind === "not_found") return err({ kind: "runtime", message: `slot not found: ${slot}` });
			return err({ kind: "runtime", message: `load failed: ${loaded.error.kind}` });
		}
		const restored = deps.snapshotter.restore(deps.world, loaded.value, { time: ctx.time, rng: ctx.rng, res: ctx.res });
		if (!restored.ok) return err({ kind: "runtime", message: `restore failed: ${restored.error.kind}` });
		return ok(`loaded from slot:${slot}`);
	},
});

let prior_scale = 1;

const pause_cmd = (): Command<readonly []> => ({
	name: "pause",
	desc: "pause simulation (sets time.scale to 0)",
	args: empty_args,
	run: (_a, ctx) => {
		if (ctx.time.scale !== 0) prior_scale = ctx.time.scale;
		ctx.time.scale = 0;
		return ok("paused");
	},
});

const resume_cmd = (): Command<readonly []> => ({
	name: "resume",
	desc: "resume simulation",
	args: empty_args,
	run: (_a, ctx) => {
		ctx.time.scale = prior_scale || 1;
		return ok(`resumed at scale ${ctx.time.scale}`);
	},
});

const tscale_cmd = (): Command<readonly [number]> => ({
	name: "tscale",
	desc: "set time.scale",
	args: number_args,
	run: ([scale], ctx) => {
		ctx.time.scale = scale;
		return ok(`time.scale=${scale}`);
	},
});

const KEY_RE = /^Key[A-Z]$|^Digit[0-9]$|^Arrow(Up|Down|Left|Right)$|^F\d{1,2}$|^Space$|^Enter$|^Escape$|^Backspace$|^Tab$|^Shift(Left|Right)$/;

const parse_trigger = (raw: string): Trigger | null => {
	if (KEY_RE.test(raw)) return { kind: "key", code: raw };
	if (raw.startsWith("key:")) return { kind: "key", code: raw.slice(4) };
	if (raw.startsWith("mouse:")) {
		const n = Number(raw.slice(6));
		if (n === 0 || n === 1 || n === 2) return { kind: "mouse", button: n };
	}
	if (raw.startsWith("pad.button:")) {
		const n = Number(raw.slice(11));
		if (Number.isFinite(n)) return { kind: "pad.button", button: n };
	}
	return null;
};

const bind_cmd = (): Command<readonly [string, string]> => ({
	name: "bind",
	desc: "bind <action> <trigger> — e.g. `bind jump Space` or `bind shoot mouse:0`",
	args: action_key_args,
	run: ([action, raw], ctx) => {
		const trigger = parse_trigger(raw);
		if (!trigger) return err({ kind: "runtime", message: `unknown trigger: ${raw}` });
		const cur = ctx.input.bindings();
		const existing = cur.digital[action] ?? [];
		ctx.input.bind({
			...cur,
			digital: { ...cur.digital, [action]: [...existing, trigger] },
		});
		return ok(`bound ${action} -> ${raw}`);
	},
});

const unbind_cmd = (): Command<readonly [string]> => ({
	name: "unbind",
	desc: "remove all bindings for <action>",
	args: action_args,
	run: ([action], ctx) => {
		const cur = ctx.input.bindings();
		const { [action]: _drop_d, ...digital } = cur.digital;
		const { [action]: _drop_a, ...axes } = cur.axes;
		ctx.input.bind({ digital, axes, deadzone: cur.deadzone });
		return ok(`unbound ${action}`);
	},
});

const inspect_cmd = (deps: BuiltinDeps): Command<readonly [number]> => ({
	name: "inspect",
	desc: "inspect entity by id",
	args: id_args,
	run: ([raw_id], ctx) => {
		const inspection = ctx.debug.inspect(deps.world, raw_id as unknown as Id);
		const lines = inspection.components.map(c => `  ${c.name} = ${JSON.stringify(c.data)}`);
		return ok(`#${raw_id}\n${lines.join("\n") || "  (no components)"}`);
	},
});

const dbg_cmd = (): Command<DbgArgs> => ({
	name: "dbg",
	desc: "toggle debug overlay (on|off|toggle)",
	args: dbg_args,
	run: (raw, ctx) => {
		const val = raw.length === 0 ? undefined : raw[0];
		if (val === undefined || val === "toggle") {
			ctx.debug.toggle();
			return ok(`debug=${ctx.debug.enabled()}`);
		}
		if (val === true || val === "on") {
			ctx.debug.on();
			return ok("debug=true");
		}
		ctx.debug.off();
		return ok("debug=false");
	},
});

export const builtins = (deps: BuiltinDeps): readonly Command<any>[] => [
	save_cmd(deps),
	load_cmd(deps),
	pause_cmd(),
	resume_cmd(),
	tscale_cmd(),
	bind_cmd(),
	unbind_cmd(),
	inspect_cmd(deps),
	dbg_cmd(),
];
