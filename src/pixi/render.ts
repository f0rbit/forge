import { ok, err, type Result } from "@f0rbit/corpus";
import { Application, Container, RenderTexture, Sprite, TextureSource } from "pixi.js";
import type { System } from "../schedule.ts";
import type { Camera, Viewport } from "./camera.ts";
import { is_dev } from "../debug/debug.ts";

export type RenderError = { kind: "init_failed"; cause: string } | { kind: "no_canvas" };

export type RenderState = {
	app: Application;
	world: Container;
	debug_overlay: Container;
	palette_overlay: Container;
	camera: Camera;
	canvas: () => HTMLCanvasElement | null;
	dispose: () => void;
	stats: { last_render_us: number; fps: number };
	render_system: () => System;
	resize: (w: number, h: number) => void;
	viewport: () => Viewport;
	set_screen_offset: (dx: number, dy: number) => void;
};

export type RenderOpts = {
	camera: Camera;
	mount?: HTMLElement | null;
	now?: () => number;
};

const make_now = (opts?: { now?: () => number }): (() => number) => {
	if (opts?.now) return opts.now;
	const perf = (globalThis as { performance?: { now: () => number } }).performance;
	if (perf && typeof perf.now === "function") return () => perf.now();
	return () => 0;
};

const apply_smoothing = (texture: { source?: { scaleMode?: string } } | null, smoothing: boolean): void => {
	if (!texture || !texture.source) return;
	texture.source.scaleMode = smoothing ? "linear" : "nearest";
};

export const make_render = async (opts: RenderOpts): Promise<Result<RenderState, RenderError>> => {
	const cam = opts.camera;
	const smoothing = cam.opts.smoothing ?? false;
	try {
		const def = (TextureSource as unknown as { defaultOptions?: { scaleMode?: string } }).defaultOptions;
		if (def) def.scaleMode = smoothing ? "linear" : "nearest";
	} catch {
		/* no-op */
	}

	const initial = cam.viewport();
	const initial_w = initial.view.width * initial.scale + initial.offset.x * 2;
	const initial_h = initial.view.height * initial.scale + initial.offset.y * 2;

	const app = new Application();
	try {
		await app.init({
			width: Math.max(1, Math.round(initial_w)),
			height: Math.max(1, Math.round(initial_h)),
			backgroundAlpha: 0,
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

	let render_texture: RenderTexture;
	try {
		render_texture = RenderTexture.create({
			width: Math.max(1, initial.view.width),
			height: Math.max(1, initial.view.height),
			dynamic: true,
		});
	} catch (e) {
		try {
			app.destroy(true, { children: true });
		} catch {
			/* no-op */
		}
		return err({ kind: "init_failed", cause: (e as Error).message ?? String(e) });
	}

	apply_smoothing(render_texture as unknown as { source?: { scaleMode?: string } }, smoothing);

	const surface_sprite = new Sprite(render_texture);
	surface_sprite.label = "forge.surface";
	surface_sprite.scale.set(initial.scale, initial.scale);
	surface_sprite.position.set(initial.offset.x, initial.offset.y);

	app.stage.addChild(surface_sprite);
	app.stage.addChild(debug_overlay);
	app.stage.addChild(palette_overlay);

	if (opts.mount) {
		const canvas = (app as unknown as { canvas?: HTMLCanvasElement }).canvas;
		if (canvas) opts.mount.appendChild(canvas);
	}

	const now = make_now(opts);
	const stats = { last_render_us: 0, fps: 0 };
	const dev = is_dev();

	let last_t = 0;
	let last_t_set = false;
	let fps_smoothed = 0;
	const FPS_SMOOTHING = 0.1;

	const update_fps = (): void => {
		if (!dev) return;
		const t = now();
		if (!last_t_set) {
			last_t = t;
			last_t_set = true;
			return;
		}
		const dt_ms = t - last_t;
		last_t = t;
		if (dt_ms <= 0) return;
		const inst_fps = 1000 / dt_ms;
		if (fps_smoothed === 0) {
			fps_smoothed = inst_fps;
		} else {
			fps_smoothed = fps_smoothed * (1 - FPS_SMOOTHING) + inst_fps * FPS_SMOOTHING;
		}
		stats.fps = fps_smoothed;
	};

	let current_dx = 0;
	let current_dy = 0;

	const apply_viewport = (vp: Viewport): void => {
		const need_w = Math.max(1, vp.view.width);
		const need_h = Math.max(1, vp.view.height);
		if (render_texture.width !== need_w || render_texture.height !== need_h) {
			render_texture.resize(need_w, need_h);
			apply_smoothing(render_texture as unknown as { source?: { scaleMode?: string } }, smoothing);
		}
		surface_sprite.scale.set(vp.scale, vp.scale);
		surface_sprite.position.set(vp.offset.x + current_dx, vp.offset.y + current_dy);
	};

	apply_viewport(initial);

	const state: RenderState = {
		app,
		world,
		debug_overlay,
		palette_overlay,
		camera: cam,
		canvas: () => (app as unknown as { canvas?: HTMLCanvasElement | null }).canvas ?? null,
		stats,
		viewport: () => cam.viewport(),
		resize: (w, h) => {
			const vp = cam.resize(w, h);
			(app.renderer as unknown as { resize?: (w: number, h: number) => void }).resize?.(w, h);
			apply_viewport(vp);
		},
		set_screen_offset: (dx, dy) => {
			current_dx = dx;
			current_dy = dy;
			const vp = cam.viewport();
			surface_sprite.position.set(vp.offset.x + dx, vp.offset.y + dy);
		},
		dispose: () => {
			try {
				render_texture.destroy(true);
			} catch {
				/* no-op */
			}
			try {
				app.destroy(true, { children: true });
			} catch {
				/* no-op */
			}
		},
		render_system: () => (_w, ctx) => {
			const t0 = now();
			try {
				app.renderer.render({ container: world, target: render_texture });
				app.render();
			} catch {
				/* no-op */
			}
			const t1 = now();
			stats.last_render_us = (t1 - t0) * 1000;
			update_fps();
			if (dev) ctx.debug.stats().fps = stats.fps;
		},
	};

	return ok(state);
};
