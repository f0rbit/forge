import type { Camera } from "./camera.ts";

export type CoordTransform = {
	readonly scale: number;
	readonly offset: { x: number; y: number };
	readonly view: { width: number; height: number };
	readonly canvas_to_world: (canvas_x: number, canvas_y: number) => { x: number; y: number };
	readonly world_to_canvas: (world_x: number, world_y: number) => { x: number; y: number };
};

export const coord_transform = (cam: Camera): CoordTransform => {
	const vp = cam.viewport();
	return {
		scale: vp.scale,
		offset: { ...vp.offset },
		view: { ...vp.view },
		canvas_to_world: (cx, cy) => cam.screen_to_world({ x: cx, y: cy }),
		world_to_canvas: (wx, wy) => cam.world_to_screen({ x: wx, y: wy }),
	};
};

/**
 * Convert a DOM pointer/mouse event to world (= design / viewport) coords.
 * Handles `getBoundingClientRect` translation + CSS-pixel-to-canvas-buffer DPR scaling.
 */
export const event_to_world = (
	e: { clientX: number; clientY: number },
	canvas: HTMLCanvasElement,
	cam: Camera,
): { x: number; y: number } => {
	const rect = canvas.getBoundingClientRect();
	const css_x = e.clientX - rect.left;
	const css_y = e.clientY - rect.top;
	const buf_scale_x = rect.width > 0 ? canvas.width / rect.width : 1;
	const buf_scale_y = rect.height > 0 ? canvas.height / rect.height : 1;
	const canvas_x = css_x * buf_scale_x;
	const canvas_y = css_y * buf_scale_y;
	return cam.screen_to_world({ x: canvas_x, y: canvas_y });
};
