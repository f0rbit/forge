import { describe, expect, test } from "bun:test";
import { camera, coord_transform, event_to_world } from "../../src/pixi/index.ts";

const fake_canvas = (opts: {
	w: number;
	h: number;
	rect?: { left: number; top: number; width: number; height: number };
}): HTMLCanvasElement => {
	const rect = opts.rect ?? { left: 0, top: 0, width: opts.w, height: opts.h };
	return {
		width: opts.w,
		height: opts.h,
		getBoundingClientRect: () => ({
			left: rect.left,
			top: rect.top,
			width: rect.width,
			height: rect.height,
			right: rect.left + rect.width,
			bottom: rect.top + rect.height,
			x: rect.left,
			y: rect.top,
			toJSON: () => "",
		}),
	} as unknown as HTMLCanvasElement;
};

describe("coord_transform", () => {
	test("returns viewport snapshot (scale, offset, view)", () => {
		const cam = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		cam.resize(640, 480);
		const ct = coord_transform(cam);
		expect(ct.scale).toBe(2);
		expect(ct.view).toEqual({ width: 320, height: 240 });
		expect(ct.offset).toEqual({ x: 0, y: 0 });
	});

	test("snapshot copies offset/view (not aliased to camera internals)", () => {
		const cam = camera({ design: { width: 320, height: 240 }, mode: "letterbox" });
		cam.resize(800, 600);
		const ct = coord_transform(cam);
		const before = { ...ct.offset };
		cam.resize(1600, 1200);
		expect(ct.offset).toEqual(before);
	});

	test("canvas_to_world matches camera.screen_to_world", () => {
		const cam = camera({ design: { width: 320, height: 240 }, mode: "extend" });
		cam.resize(800, 600);
		const ct = coord_transform(cam);
		const a = ct.canvas_to_world(123, 87);
		const b = cam.screen_to_world({ x: 123, y: 87 });
		expect(a.x).toBeCloseTo(b.x, 10);
		expect(a.y).toBeCloseTo(b.y, 10);
	});

	test("world_to_canvas matches camera.world_to_screen", () => {
		const cam = camera({ design: { width: 320, height: 240 }, mode: "extend" });
		cam.resize(800, 600);
		const ct = coord_transform(cam);
		const a = ct.world_to_canvas(42, 99);
		const b = cam.world_to_screen({ x: 42, y: 99 });
		expect(a.x).toBeCloseTo(b.x, 10);
		expect(a.y).toBeCloseTo(b.y, 10);
	});

	test("roundtrip across full viewport (30x20 grid @ tile 16, extend, pixel_perfect)", () => {
		const cam = camera({
			design: { width: 480, height: 320 },
			mode: "extend",
			min: { width: 480, height: 320 },
			pixel_perfect: true,
		});
		cam.resize(1368, 1045);
		const ct = coord_transform(cam);
		const tile = 16;
		for (let cy = 0; cy < 20; cy++) {
			for (let cx = 0; cx < 30; cx++) {
				const world = { x: cx * tile + tile / 2, y: cy * tile + tile / 2 };
				const canvas = ct.world_to_canvas(world.x, world.y);
				const back = ct.canvas_to_world(canvas.x, canvas.y);
				expect(Math.floor(back.x / tile)).toBe(cx);
				expect(Math.floor(back.y / tile)).toBe(cy);
			}
		}
	});
});

describe("event_to_world", () => {
	const make_cam = () => {
		const cam = camera({
			design: { width: 480, height: 320 },
			mode: "extend",
			min: { width: 480, height: 320 },
			pixel_perfect: true,
		});
		cam.resize(1368, 1045);
		return cam;
	};

	test("1x DPR: matches direct screen_to_world", () => {
		const cam = make_cam();
		const canvas = fake_canvas({ w: 1368, h: 1045 });
		const event = { clientX: 684, clientY: 522 };
		const got = event_to_world(event, canvas, cam);
		const want = cam.screen_to_world({ x: 684, y: 522 });
		expect(got.x).toBeCloseTo(want.x, 10);
		expect(got.y).toBeCloseTo(want.y, 10);
	});

	test("2x DPR scaling: HiDPI buffer maps to same world coord as 1x case (fit mode, linear)", () => {
		const cam_1x = camera({ design: { width: 480, height: 320 }, mode: "fit" });
		cam_1x.resize(960, 640);
		const cam_2x = camera({ design: { width: 480, height: 320 }, mode: "fit" });
		cam_2x.resize(1920, 1280);
		const canvas_1x = fake_canvas({ w: 960, h: 640 });
		const canvas_2x = fake_canvas({
			w: 1920,
			h: 1280,
			rect: { left: 0, top: 0, width: 960, height: 640 },
		});
		const event = { clientX: 480, clientY: 320 };
		const a = event_to_world(event, canvas_1x, cam_1x);
		const b = event_to_world(event, canvas_2x, cam_2x);
		expect(b.x).toBeCloseTo(a.x, 10);
		expect(b.y).toBeCloseTo(a.y, 10);
	});

	test("2x DPR scaling: buffer scale ratio applied (no Pixi resize)", () => {
		// When Pixi is NOT informed of the DPR (camera at CSS px), event_to_world
		// must still compute the canvas-buffer pixel using the rect/buffer ratio.
		// Verifies the buf_scale_x = canvas.width / rect.width factor is wired up.
		const cam = make_cam();
		const canvas_2x = fake_canvas({
			w: 2736,
			h: 2090,
			rect: { left: 0, top: 0, width: 1368, height: 1045 },
		});
		const event = { clientX: 684, clientY: 522 };
		const got = event_to_world(event, canvas_2x, cam);
		// css (684,522) -> buffer (1368,1044) -> world via cam at view scale 2
		const expected = cam.screen_to_world({ x: 1368, y: 1044 });
		expect(got.x).toBeCloseTo(expected.x, 10);
		expect(got.y).toBeCloseTo(expected.y, 10);
	});

	test("rect offset: canvas not at page origin still lands at same world coord", () => {
		const cam = make_cam();
		const canvas_origin = fake_canvas({ w: 1368, h: 1045 });
		const canvas_offset = fake_canvas({
			w: 1368,
			h: 1045,
			rect: { left: 100, top: 50, width: 1368, height: 1045 },
		});
		const a = event_to_world({ clientX: 684, clientY: 522 }, canvas_origin, cam);
		const b = event_to_world({ clientX: 784, clientY: 572 }, canvas_offset, cam);
		expect(b.x).toBeCloseTo(a.x, 10);
		expect(b.y).toBeCloseTo(a.y, 10);
	});

	test("degenerate rect (width=0): does not divide-by-zero, falls back to scale=1", () => {
		const cam = make_cam();
		const canvas = fake_canvas({
			w: 1368,
			h: 1045,
			rect: { left: 0, top: 0, width: 0, height: 0 },
		});
		const result = event_to_world({ clientX: 100, clientY: 100 }, canvas, cam);
		expect(Number.isFinite(result.x)).toBe(true);
		expect(Number.isFinite(result.y)).toBe(true);
		const want = cam.screen_to_world({ x: 100, y: 100 });
		expect(result.x).toBeCloseTo(want.x, 10);
		expect(result.y).toBeCloseTo(want.y, 10);
	});
});
