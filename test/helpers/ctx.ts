import { time, rng, resources, input, debug_noop, palette_noop, type Ctx, type Time, type Rng, type Resources, type Input } from "../../src/index.ts";

export type CtxOpts = {
	time?: Time;
	rng?: Rng;
	res?: Resources;
	input?: Input;
};

export const make_ctx = (opts?: CtxOpts): Ctx => ({
	time: opts?.time ?? time(),
	rng: opts?.rng ?? rng(1),
	res: opts?.res ?? resources(),
	input: opts?.input ?? input(),
	debug: debug_noop(),
	palette: palette_noop(),
});
