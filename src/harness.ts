import { world, type World } from "./world.ts";
import { schedule, type Schedule, type Ctx } from "./schedule.ts";
import { time, type Time } from "./time.ts";
import { rng, type Rng } from "./rng.ts";
import { resources, type Resources } from "./resources.ts";
import { input, type Input } from "./input/input.ts";
import { type Bindings, empty_bindings } from "./input/bindings.ts";
import { debug, debug_noop, type Debug } from "./debug/debug.ts";
import { palette, type Palette } from "./palette/palette.ts";

export type HarnessOpts = {
	seed?: number;
	fixed_dt?: number;
	bindings?: Bindings;
	__dev__?: boolean;
};

export type Harness = {
	world: World;
	schedule: Schedule;
	time: Time;
	rng: Rng;
	res: Resources;
	input: Input;
	debug: Debug;
	palette: Palette;
	ctx: Ctx;
	tick: (real_dt?: number) => void;
};

export const harness = (opts?: HarnessOpts): Harness => {
	const seed = opts?.seed ?? 0;
	const fixed_dt = opts?.fixed_dt ?? 1 / 60;
	const bindings = opts?.bindings ?? empty_bindings();
	const dev = opts?.__dev__ ?? true;

	const w = world();
	const sch = schedule();
	const t = time({ fixed_dt });
	const r = rng(seed);
	const res = resources();
	const inp = input(bindings);
	const dbg = dev ? debug({ enabled: true, dev: true }) : debug_noop();
	const pal = palette();

	const ctx: Ctx = {
		time: t,
		rng: r,
		res,
		input: inp,
		debug: dbg,
		palette: pal,
	};

	const tick_fn = (real_dt?: number): void => {
		const dt = real_dt ?? fixed_dt;
		t.advance(dt);
		sch.run("update", w, ctx);
		dbg.frame();
	};

	return {
		world: w,
		schedule: sch,
		time: t,
		rng: r,
		res,
		input: inp,
		debug: dbg,
		palette: pal,
		ctx,
		tick: tick_fn,
	};
};
