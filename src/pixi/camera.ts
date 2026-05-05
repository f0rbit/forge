export type CameraMode = "letterbox" | "extend" | "extend-x" | "extend-y" | "fit";

export type CameraOpts = {
	design: { width: number; height: number };
	mode: CameraMode;
	min?: { width: number; height: number };
	max?: { width: number; height: number };
	pixel_perfect?: boolean;
	smoothing?: boolean;
};

export type Viewport = {
	scale: number;
	view: { width: number; height: number };
	offset: { x: number; y: number };
};

export type Camera = {
	readonly opts: CameraOpts;
	viewport: () => Viewport;
	resize: (window_w: number, window_h: number) => Viewport;
	world_to_screen: (p: { x: number; y: number }) => { x: number; y: number };
	screen_to_world: (p: { x: number; y: number }) => { x: number; y: number };
};

const DEV = (() => {
	const g = globalThis as { __DEV__?: boolean };
	if (typeof g.__DEV__ === "boolean") return g.__DEV__;
	const proc = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
	return proc?.env?.NODE_ENV !== "production";
})();

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const compute_scale = (design_w: number, design_h: number, ww: number, wh: number, pixel_perfect: boolean): number => {
	const sx = ww / design_w;
	const sy = wh / design_h;
	const raw = Math.min(sx, sy);
	if (!pixel_perfect) return raw;
	if (raw < 1) {
		if (DEV) {
			const console_obj = (globalThis as { console?: { warn: (msg: string) => void } }).console;
			console_obj?.warn?.(`forge.camera: window ${ww}x${wh} smaller than design ${design_w}x${design_h}; falling back to fractional scale ${raw.toFixed(3)} (pixel_perfect ignored)`);
		}
		return raw;
	}
	return Math.max(1, Math.floor(raw));
};

const compute_viewport = (opts: CameraOpts, ww: number, wh: number): Viewport => {
	const design = opts.design;
	const pixel_perfect = opts.pixel_perfect ?? true;

	if (opts.mode === "fit") {
		const scale = Math.min(ww / design.width, wh / design.height);
		const offset_x = (ww - design.width * scale) / 2;
		const offset_y = (wh - design.height * scale) / 2;
		return {
			scale,
			view: { width: design.width, height: design.height },
			offset: { x: offset_x, y: offset_y },
		};
	}

	const scale = compute_scale(design.width, design.height, ww, wh, pixel_perfect);

	if (opts.mode === "letterbox") {
		const offset_x = (ww - design.width * scale) / 2;
		const offset_y = (wh - design.height * scale) / 2;
		return {
			scale,
			view: { width: design.width, height: design.height },
			offset: { x: offset_x, y: offset_y },
		};
	}

	const min = opts.min;
	const max = opts.max;

	const extend_x = opts.mode === "extend" || opts.mode === "extend-x";
	const extend_y = opts.mode === "extend" || opts.mode === "extend-y";

	const view_w_raw = extend_x ? Math.round(ww / scale) : design.width;
	const view_h_raw = extend_y ? Math.round(wh / scale) : design.height;

	const view_w = clamp(view_w_raw, min?.width ?? -Infinity, max?.width ?? Infinity);
	const view_h = clamp(view_h_raw, min?.height ?? -Infinity, max?.height ?? Infinity);

	const offset_x = (ww - view_w * scale) / 2;
	const offset_y = (wh - view_h * scale) / 2;

	return {
		scale,
		view: { width: view_w, height: view_h },
		offset: { x: offset_x, y: offset_y },
	};
};

export const camera = (opts: CameraOpts): Camera => {
	let current: Viewport = compute_viewport(opts, opts.design.width, opts.design.height);

	const api: Camera = {
		opts,
		viewport: () => current,
		resize: (ww, wh) => {
			current = compute_viewport(opts, ww, wh);
			return current;
		},
		world_to_screen: p => ({
			x: current.offset.x + p.x * current.scale,
			y: current.offset.y + p.y * current.scale,
		}),
		screen_to_world: p => ({
			x: (p.x - current.offset.x) / current.scale,
			y: (p.y - current.offset.y) / current.scale,
		}),
	};
	return api;
};
