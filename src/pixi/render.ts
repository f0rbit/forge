import { ok, err, type Result } from "@f0rbit/corpus";
import { Application, Container } from "pixi.js";
import type { System } from "../schedule.ts";
import type { Camera } from "./camera.ts";

export type RenderError = { kind: "init_failed"; cause: string } | { kind: "no_canvas" };

export type RenderState = {
	app: Application;
	world: Container;
	debug_overlay: Container;
	palette_overlay: Container;
	camera: Camera | null;
	set_camera: (cam: Camera) => void;
	canvas: () => HTMLCanvasElement | null;
	dispose: () => void;
	stats: { last_render_us: number; fps: number };
	render_system: () => System;
	resize: (w: number, h: number) => void;
};

export type RenderOpts = {
	width: number;
	height: number;
	background?: number | string;
	mount?: HTMLElement | null;
	camera?: Camera;
	now?: () => number;
};

const make_now = (opts?: { now?: () => number }): (() => number) => {
	if (opts?.now) return opts.now;
	const perf = (globalThis as { performance?: { now: () => number } }).performance;
	if (perf && typeof perf.now === "function") return () => perf.now();
	return () => 0;
};

export const make_render = async (opts: RenderOpts): Promise<Result<RenderState, RenderError>> => {
	const app = new Application();
	try {
		await app.init({
			width: opts.width,
			height: opts.height,
			background: opts.background ?? 0x101820,
			autoStart: false,
		});
	} catch (e) {
		return err({ kind: "init_failed", cause: (e as Error).message ?? String(e) });
	}

	const world = new Container();
	world.label = "forge.world";
	world.sortableChildren = true;

	const debug_overlay = new Container();
	debug_overlay.label = "forge.debug";

	const palette_overlay = new Container();
	palette_overlay.label = "forge.palette";
	palette_overlay.visible = false;

	app.stage.addChild(world);
	app.stage.addChild(debug_overlay);
	app.stage.addChild(palette_overlay);

	if (opts.mount) {
		const canvas = (app as unknown as { canvas?: HTMLCanvasElement }).canvas;
		if (canvas) opts.mount.appendChild(canvas);
	}

	const now = make_now(opts);
	const stats = { last_render_us: 0, fps: 0 };
	let last_t = now();
	let frame_count = 0;
	let fps_acc = 0;

	const state: RenderState = {
		app,
		world,
		debug_overlay,
		palette_overlay,
		camera: opts.camera ?? null,
		set_camera: cam => {
			state.camera = cam;
			cam.apply(world);
		},
		canvas: () => (app as unknown as { canvas?: HTMLCanvasElement | null }).canvas ?? null,
		stats,
		resize: (w, h) => {
			(app.renderer as unknown as { resize?: (w: number, h: number) => void }).resize?.(w, h);
			if (state.camera) {
				state.camera.resize(w, h);
				state.camera.apply(world);
			}
		},
		dispose: () => {
			try {
				app.destroy(true, { children: true });
			} catch {
				/* no-op */
			}
		},
		render_system: () => (_w, _ctx) => {
			const t0 = now();
			if (state.camera) state.camera.apply(world);
			try {
				app.render();
			} catch {
				/* no-op */
			}
			const t1 = now();
			stats.last_render_us = (t1 - t0) * 1000;
			frame_count += 1;
			const dt = t1 - last_t;
			fps_acc += dt;
			if (fps_acc >= 1000) {
				stats.fps = (frame_count * 1000) / fps_acc;
				frame_count = 0;
				fps_acc = 0;
			}
			last_t = t1;
		},
	};

	if (opts.camera) opts.camera.apply(world);
	return ok(state);
};
