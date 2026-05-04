import type { Container } from "pixi.js";
import type { Vec2 } from "../math.ts";

export type CameraMode = "fit" | "fill" | "fixed";

export type CameraOpts = {
	mode?: CameraMode;
	width: number;
	height: number;
	pos?: Vec2;
	zoom?: number;
};

export type Camera = {
	readonly mode: CameraMode;
	readonly logical_width: number;
	readonly logical_height: number;
	pos: Vec2;
	zoom: number;
	resize: (window_w: number, window_h: number) => void;
	apply: (root: Container) => void;
	world_to_screen: (p: Vec2) => Vec2;
	screen_to_world: (p: Vec2) => Vec2;
	state: () => { scale: number; offset_x: number; offset_y: number; window_w: number; window_h: number };
};

const compute_fit = (lw: number, lh: number, ww: number, wh: number): { scale: number; offset_x: number; offset_y: number } => {
	const sx = ww / lw;
	const sy = wh / lh;
	const scale = Math.min(sx, sy);
	const offset_x = (ww - lw * scale) / 2;
	const offset_y = (wh - lh * scale) / 2;
	return { scale, offset_x, offset_y };
};

const compute_fill = (lw: number, lh: number, ww: number, wh: number): { scale: number; offset_x: number; offset_y: number } => {
	const sx = ww / lw;
	const sy = wh / lh;
	const scale = Math.max(sx, sy);
	const offset_x = (ww - lw * scale) / 2;
	const offset_y = (wh - lh * scale) / 2;
	return { scale, offset_x, offset_y };
};

const compute_fixed = (): { scale: number; offset_x: number; offset_y: number } => ({ scale: 1, offset_x: 0, offset_y: 0 });

export const camera = (opts: CameraOpts): Camera => {
	const mode: CameraMode = opts.mode ?? "fit";
	const lw = opts.width;
	const lh = opts.height;
	const state = {
		scale: 1,
		offset_x: 0,
		offset_y: 0,
		window_w: lw,
		window_h: lh,
	};
	const view = {
		pos: opts.pos ?? { x: 0, y: 0 },
		zoom: opts.zoom ?? 1,
	};

	const recompute = (): void => {
		const result = mode === "fit"
			? compute_fit(lw, lh, state.window_w, state.window_h)
			: mode === "fill"
				? compute_fill(lw, lh, state.window_w, state.window_h)
				: compute_fixed();
		state.scale = result.scale;
		state.offset_x = result.offset_x;
		state.offset_y = result.offset_y;
	};

	recompute();

	return {
		mode,
		logical_width: lw,
		logical_height: lh,
		get pos() {
			return view.pos;
		},
		set pos(v: Vec2) {
			view.pos = v;
		},
		get zoom() {
			return view.zoom;
		},
		set zoom(z: number) {
			view.zoom = z;
		},
		resize: (ww, wh) => {
			state.window_w = ww;
			state.window_h = wh;
			recompute();
		},
		apply: root => {
			const total = state.scale * view.zoom;
			root.position.set(state.offset_x - view.pos.x * total, state.offset_y - view.pos.y * total);
			root.scale.set(total);
		},
		world_to_screen: p => {
			const total = state.scale * view.zoom;
			return {
				x: state.offset_x + (p.x - view.pos.x) * total,
				y: state.offset_y + (p.y - view.pos.y) * total,
			};
		},
		screen_to_world: p => {
			const total = state.scale * view.zoom;
			return {
				x: (p.x - state.offset_x) / total + view.pos.x,
				y: (p.y - state.offset_y) / total + view.pos.y,
			};
		},
		state: () => ({ ...state }),
	};
};
