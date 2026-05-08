import { ok, err, type Result } from "@f0rbit/corpus";
import type { Application } from "pixi.js";
import type { Bindings } from "../input/bindings.ts";
import type { World, Component } from "../world.ts";
import { pos_c } from "../index.ts";
import { follow_system } from "../follow.ts";
import type { Schedule, Ctx } from "../schedule.ts";
import type { Time } from "../time.ts";
import type { Rng } from "../rng.ts";
import type { Resources } from "../resources.ts";
import type { Input } from "../input/input.ts";
import type { Debug } from "../debug/debug.ts";
import type { Palette } from "../palette/palette.ts";
import type { EngineStore } from "../storage/engine-store.ts";
import type { AtlasRegistry } from "../anim.ts";
import { atlas_registry_r } from "../anim.ts";
import { input as make_input } from "../input/input.ts";
import { time as make_time } from "../time.ts";
import { rng as make_rng } from "../rng.ts";
import { resources as make_resources } from "../resources.ts";
import { debug as make_debug } from "../debug/debug.ts";
import { palette as make_palette } from "../palette/palette.ts";
import { world as make_world } from "../world.ts";
import { schedule as make_schedule } from "../schedule.ts";

import { assets, type AssetError, type Assets_, type AssetsOpts, type AssetKind, type LoadValue } from "./assets.ts";
import { browser_source, type BrowserSource, type BrowserSourceOpts } from "./input-browser.ts";
import { camera, type Camera, type CameraOpts, type CameraMode, type Viewport } from "./camera.ts";
import { make_render, type RenderState, type RenderError, type RenderOpts } from "./render.ts";
import { sprite, sprite_c, sprite_sync_system, type SpriteData, type SpriteSystemOpts } from "./sprite.ts";
import { anim_sync_system, type AnimPixiOpts } from "./anim-pixi.ts";
import { debug_pixi, type DebugPixiOpts } from "./debug-pixi.ts";
import { palette_pixi, type PalettePixiOpts } from "./palette-pixi.ts";

export {
	assets,
	browser_source,
	camera,
	make_render,
	sprite,
	sprite_c,
	sprite_sync_system,
	anim_sync_system,
	debug_pixi,
	palette_pixi,
};

export type {
	AssetError,
	AssetKind,
	LoadValue,
	Assets_ as Assets,
	AssetsOpts,
	BrowserSource,
	BrowserSourceOpts,
	Camera,
	CameraOpts,
	CameraMode,
	Viewport,
	RenderState,
	RenderError,
	RenderOpts,
	SpriteData,
	SpriteSystemOpts,
	AnimPixiOpts,
	DebugPixiOpts,
	PalettePixiOpts,
};

export type AssetSpec =
	| { kind: "image"; alias: string; url: string }
	| { kind: "atlas"; alias: string; url: string };

export type BootError =
	| { kind: "mount_not_found"; selector: string }
	| { kind: "render_failed"; cause: RenderError }
	| { kind: "asset_failed"; alias: string; cause: AssetError };

export type BootOpts = {
	mount: HTMLElement | string;
	world?: World;
	schedule?: Schedule;
	time?: Time;
	rng?: Rng;
	res?: Resources;
	input?: Input;
	debug?: Debug;
	palette?: Palette;
	bindings?: Bindings;
	engine_store?: EngineStore;
	camera?: CameraOpts;
	window?: { width: number; height: number };
	assets?: readonly AssetSpec[];
	pos?: Component<{ x: number; y: number }>;
	__dev__?: boolean;
};

export type App = {
	app: Application;
	world: World;
	schedule: Schedule;
	time: Time;
	rng: Rng;
	res: Resources;
	input: Input;
	debug: Debug;
	palette: Palette;
	assets: Assets_;
	render: RenderState;
	camera: Camera;
	source: BrowserSource;
	tick: (real_dt: number) => void;
	start: () => void;
	stop: () => void;
	dispose: () => void;
	canvas: () => HTMLCanvasElement | null;
	ctx: () => Ctx;
};

const resolve_mount = (mount: HTMLElement | string): Result<HTMLElement, BootError> => {
	if (typeof mount !== "string") return ok(mount);
	const doc = (globalThis as { document?: Document }).document;
	if (!doc) return err({ kind: "mount_not_found", selector: mount });
	const el = doc.querySelector(mount);
	if (!el) return err({ kind: "mount_not_found", selector: mount });
	return ok(el as HTMLElement);
};

export const boot = async (opts: BootOpts): Promise<Result<App, BootError>> => {
	const mount_r = resolve_mount(opts.mount);
	if (!mount_r.ok) return mount_r;
	const mount = mount_r.value;

	const design_w = opts.camera?.design.width ?? 640;
	const design_h = opts.camera?.design.height ?? 360;
	const window_w = opts.window?.width ?? design_w;
	const window_h = opts.window?.height ?? design_h;

	const w = opts.world ?? make_world();
	const sch = opts.schedule ?? make_schedule();
	const t = opts.time ?? make_time();
	const r = opts.rng ?? make_rng(1);
	const res = opts.res ?? make_resources();
	const inp = opts.input ?? make_input(opts.bindings);
	const dbg = opts.debug ?? make_debug();
	const pal = opts.palette ?? make_palette();

	if (opts.bindings) inp.bind(opts.bindings);

	const cam = camera(opts.camera ?? {
		design: { width: design_w, height: design_h },
		mode: "letterbox",
	});
	cam.resize(window_w, window_h);

	const render_r = await make_render({ mount, camera: cam });
	if (!render_r.ok) return err({ kind: "render_failed", cause: render_r.error });
	const render = render_r.value;

	const a = assets({ fixed_dt: t.fixed_dt, register_default: true });
	if (!res.has(atlas_registry_r)) {
		res.set(atlas_registry_r, a.registry() as AtlasRegistry);
	} else {
		const cur = res.get(atlas_registry_r);
		if (cur.ok) {
			const merged = cur.value;
			for (const [alias, seqs] of Object.entries(a.registry())) {
				if (!(alias in merged)) merged[alias] = seqs;
			}
		}
	}

	if (opts.assets) {
		for (const spec of opts.assets) {
			const result = await a.load(spec.kind, spec.alias, spec.url);
			if (!result.ok) {
				render.dispose();
				return err({ kind: "asset_failed", alias: spec.alias, cause: result.error });
			}
		}
		const cur = res.get(atlas_registry_r);
		if (cur.ok) {
			for (const [alias, seqs] of Object.entries(a.registry())) {
				cur.value[alias] = seqs;
			}
		}
	}

	const source = browser_source({ deadzone: opts.bindings?.deadzone, get_time: () => t.tick });
	inp.source(source);

	const ctx_obj: Ctx = {
		time: t,
		rng: r,
		res,
		input: inp,
		debug: dbg,
		palette: pal,
		store: opts.engine_store,
	};

	const dbg_sys = debug_pixi({ overlay: render.debug_overlay, dev: opts.__dev__ });
	const pal_ui = palette_pixi({
		overlay: render.palette_overlay,
		palette: pal,
		get_ctx: () => ctx_obj,
	});

	const pos = opts.pos ?? pos_c;
	sch.add("post", follow_system(pos), "forge.follow");
	sch.add("post", sprite_sync_system({ assets: a, world_container: render.world, pos_component: pos }), "forge.sprite_sync");
	sch.add("post", anim_sync_system({ assets: a }), "forge.anim_sync");
	sch.add("render", dbg_sys, "forge.debug_pixi");
	sch.add("render", pal_ui.system, "forge.palette_pixi");
	sch.add("render", render.render_system(), "forge.render");

	let raf_id: number | null = null;
	const win = (globalThis as { requestAnimationFrame?: (cb: (t: number) => void) => number; cancelAnimationFrame?: (h: number) => void });
	let last_real_t = 0;

	const tick = (real_dt: number): void => {
		t.advance(real_dt, () => sch.tick(w, ctx_obj));
	};

	const loop = (now: number): void => {
		const dt = last_real_t === 0 ? 1 / 60 : Math.max(0, (now - last_real_t) / 1000);
		last_real_t = now;
		tick(dt);
		if (win.requestAnimationFrame) raf_id = win.requestAnimationFrame(loop);
	};

	const start = (): void => {
		if (raf_id !== null) return;
		last_real_t = 0;
		if (win.requestAnimationFrame) raf_id = win.requestAnimationFrame(loop);
	};
	const stop = (): void => {
		if (raf_id !== null && win.cancelAnimationFrame) win.cancelAnimationFrame(raf_id);
		raf_id = null;
	};

	const app_handle: App = {
		app: render.app,
		world: w,
		schedule: sch,
		time: t,
		rng: r,
		res,
		input: inp,
		debug: dbg,
		palette: pal,
		assets: a,
		render,
		camera: cam,
		source,
		tick,
		start,
		stop,
		dispose: () => {
			stop();
			pal_ui.dispose();
			source.dispose();
			render.dispose();
		},
		canvas: render.canvas,
		ctx: () => ctx_obj,
	};

	return ok(app_handle);
};
