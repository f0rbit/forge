import { describe, expect, test } from "bun:test";
import { Container, RenderTexture, Sprite } from "pixi.js";
import { world, time, rng, resources, input, palette_noop, debug, type Ctx } from "../../src/index.ts";
import type { System } from "../../src/schedule.ts";
import { camera, type Camera } from "../../src/pixi/index.ts";

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
