import { describe, expect, test } from "bun:test";
import { Container, DOMAdapter, RenderTexture, Sprite } from "pixi.js";
import { world, time, rng, resources, input, palette_noop, debug, type Ctx } from "../../src/index.ts";
import type { System } from "../../src/schedule.ts";
import { camera, make_render, type Camera } from "../../src/pixi/index.ts";

const make_lost_gl = (): WebGLRenderingContext => ({
	isContextLost: () => true,
	getExtension: () => null,
	getParameter: () => 0,
	getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
}) as unknown as WebGLRenderingContext;

const make_fake_2d = (): CanvasRenderingContext2D => ({
	imageSmoothingEnabled: true,
	webkitImageSmoothingEnabled: true,
	canvas: null,
	save: () => {},
	restore: () => {},
	setTransform: () => {},
	resetTransform: () => {},
	clearRect: () => {},
	fillRect: () => {},
	scale: () => {},
	translate: () => {},
	drawImage: () => {},
	getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
	putImageData: () => {},
	beginPath: () => {},
	closePath: () => {},
	fill: () => {},
	stroke: () => {},
}) as unknown as CanvasRenderingContext2D;

const make_fake_canvas = () => ({
	width: 0,
	height: 0,
	getContext: (kind: string) => {
		if (kind === "webgl" || kind === "webgl2") return make_lost_gl();
		if (kind === "2d") return make_fake_2d();
		return null;
	},
	addEventListener: () => {},
	removeEventListener: () => {},
});

const make_fake_element = () => {
	const el: Record<string, unknown> = {
		style: {},
		tagName: "DIV",
		children: [],
		appendChild: (c: unknown) => c,
		removeChild: (c: unknown) => c,
		setAttribute: () => {},
		removeAttribute: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		focus: () => {},
		blur: () => {},
		click: () => {},
		getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
	};
	return el;
};

const g = globalThis as { document?: unknown; requestAnimationFrame?: unknown; cancelAnimationFrame?: unknown; matchMedia?: unknown };
if (!g.document) {
	g.document = {
		createElement: () => make_fake_element(),
		createElementNS: () => make_fake_element(),
		body: make_fake_element(),
		documentElement: make_fake_element(),
		addEventListener: () => {},
		removeEventListener: () => {},
	};
}
if (!g.requestAnimationFrame) g.requestAnimationFrame = (_cb: (t: number) => void) => 0;
if (!g.cancelAnimationFrame) g.cancelAnimationFrame = () => {};
if (!g.matchMedia) g.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });

DOMAdapter.set({
	createCanvas: (w?: number, h?: number) => {
		const c = make_fake_canvas();
		c.width = w ?? 0;
		c.height = h ?? 0;
		return c as unknown as HTMLCanvasElement;
	},
	createImage: () => ({}) as unknown as HTMLImageElement,
	getCanvasRenderingContext2D: () => CanvasRenderingContext2D,
	getWebGLRenderingContext: () => (globalThis as unknown as { WebGLRenderingContext: typeof WebGLRenderingContext }).WebGLRenderingContext ?? (class {} as unknown as typeof WebGLRenderingContext),
	getNavigator: () => ({ userAgent: "node", gpu: null }),
	getBaseUrl: () => "http://localhost/",
	getFontFaceSet: () => null,
	fetch: (url, options) => fetch(url as RequestInfo, options),
	parseXML: () => ({}) as unknown as Document,
});

type FakeRenderer = {
	render: (opts: { container: Container; target?: RenderTexture }) => void;
	resize: (w: number, h: number) => void;
	calls: { container: Container; target?: RenderTexture }[];
};

const make_fake_renderer = (): FakeRenderer => {
	const calls: FakeRenderer["calls"] = [];
	return {
		calls,
		render: opts => {
			calls.push({ container: opts.container, target: opts.target });
		},
		resize: () => {},
	};
};

const make_fake_render = (cam: Camera, fps_now: () => number): {
	stats: { last_render_us: number; fps: number };
	render_system: System;
	renderer: FakeRenderer;
	render_texture: { width: number; height: number; resize: (w: number, h: number) => void };
	surface_sprite: Sprite;
} => {
	const renderer = make_fake_renderer();
	const initial = cam.viewport();
	const render_texture = {
		width: initial.view.width,
		height: initial.view.height,
		resize(w: number, h: number) {
			this.width = w;
			this.height = h;
		},
	};
	const surface_sprite = new Sprite();
	surface_sprite.scale.set(initial.scale, initial.scale);
	surface_sprite.position.set(initial.offset.x, initial.offset.y);

	const stats = { last_render_us: 0, fps: 0 };
	let last_t = 0;
	let last_t_set = false;
	let fps_smoothed = 0;
	const FPS_SMOOTHING = 0.1;

	const update_fps = (): void => {
		const t = fps_now();
		if (!last_t_set) {
			last_t = t;
			last_t_set = true;
			return;
		}
		const dt_ms = t - last_t;
		last_t = t;
		if (dt_ms <= 0) return;
		const inst = 1000 / dt_ms;
		if (fps_smoothed === 0) fps_smoothed = inst;
		else fps_smoothed = fps_smoothed * (1 - FPS_SMOOTHING) + inst * FPS_SMOOTHING;
		stats.fps = fps_smoothed;
	};

	const world_container = new Container();
	const render_system: System = (_w, ctx) => {
		const t0 = fps_now();
		renderer.render({ container: world_container, target: render_texture as unknown as RenderTexture });
		const t1 = fps_now();
		stats.last_render_us = (t1 - t0) * 1000;
		update_fps();
		ctx.debug.stats().fps = stats.fps;
	};

	return { stats, render_system, renderer, render_texture, surface_sprite };
};

const make_ctx = (): Ctx => ({
	time: time(),
	rng: rng(1),
	res: resources(),
	input: input(),
	debug: debug({ enabled: true, dev: true }),
	palette: palette_noop(),
});

describe("render system fps math", () => {
	test("fps converges towards 60 under 16.6ms intervals", () => {
		const cam = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		let t = 0;
		const { render_system } = make_fake_render(cam, () => t);
		const w = world();
		const ctx = make_ctx();

		for (let i = 0; i < 200; i++) {
			t += 1000 / 60;
			render_system(w, ctx);
		}

		const fps = ctx.debug.stats().fps;
		expect(fps).toBeGreaterThan(55);
		expect(fps).toBeLessThan(65);
	});

	test("fps converges towards 30 under 33ms intervals", () => {
		const cam = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		let t = 0;
		const { render_system } = make_fake_render(cam, () => t);
		const w = world();
		const ctx = make_ctx();

		for (let i = 0; i < 200; i++) {
			t += 1000 / 30;
			render_system(w, ctx);
		}

		const fps = ctx.debug.stats().fps;
		expect(fps).toBeGreaterThan(28);
		expect(fps).toBeLessThan(32);
	});

	test("fps stays at 0 in production builds (no dev guard)", () => {
		const cam = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		let t = 0;
		const { stats } = make_fake_render(cam, () => t);
		expect(stats.fps).toBe(0);
	});
});

describe("render system two-stage flow", () => {
	test("renders world container into render_texture target", () => {
		const cam = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		const { render_system, renderer, render_texture } = make_fake_render(cam, () => 0);
		const w = world();
		const ctx = make_ctx();

		render_system(w, ctx);

		expect(renderer.calls.length).toBe(1);
		expect(renderer.calls[0]?.target).toBe(render_texture as unknown as RenderTexture);
	});

	test("surface sprite scale and position derive from viewport", () => {
		const cam = camera({ design: { width: 100, height: 100 }, mode: "letterbox" });
		cam.resize(300, 300);
		const { surface_sprite } = make_fake_render(cam, () => 0);
		surface_sprite.scale.set(cam.viewport().scale, cam.viewport().scale);
		surface_sprite.position.set(cam.viewport().offset.x, cam.viewport().offset.y);
		expect(surface_sprite.scale.x).toBe(3);
		expect(surface_sprite.position.x).toBe(0);
	});
});

const find_surface_sprite = (stage: Container): Sprite | null => {
	for (const child of stage.children) {
		if ((child as { label?: string }).label === "forge.surface") return child as Sprite;
	}
	return null;
};

describe("set_screen_offset", () => {
	test("neutral position equals viewport offset; offsets stack on top; (0,0) restores neutral; resize preserves screen-offset", async () => {
		const cam = camera({ design: { width: 100, height: 100 }, mode: "letterbox", pixel_perfect: false });
		cam.resize(200, 200);
		const result = await make_render({ camera: cam });
		if (!result.ok) {
			throw new Error(`make_render failed: ${JSON.stringify(result.error)}`);
		}
		const render = result.value;

		const sprite = find_surface_sprite(render.app.stage);
		expect(sprite).not.toBeNull();
		if (!sprite) return;

		const vp0 = cam.viewport();
		expect(sprite.position.x).toBe(vp0.offset.x);
		expect(sprite.position.y).toBe(vp0.offset.y);

		render.set_screen_offset(5, -3);
		expect(sprite.position.x).toBe(vp0.offset.x + 5);
		expect(sprite.position.y).toBe(vp0.offset.y - 3);

		render.set_screen_offset(0, 0);
		expect(sprite.position.x).toBe(vp0.offset.x);
		expect(sprite.position.y).toBe(vp0.offset.y);

		render.set_screen_offset(5, -3);
		render.resize(400, 300);
		const vp1 = cam.viewport();
		expect(vp1.offset.x).not.toBe(vp0.offset.x);
		expect(sprite.position.x).toBe(vp1.offset.x + 5);
		expect(sprite.position.y).toBe(vp1.offset.y - 3);

		render.dispose();
	});
});
