import { describe, expect, test } from "bun:test";
import { DOMAdapter } from "pixi.js";
import {
	candle_flicker,
	fluorescent_flicker,
	make_light_system,
	presets,
	sine_flicker,
	torch_flicker,
} from "../../src/pixi/light/index.ts";
import { grid } from "../../src/grid/index.ts";

const make_lost_gl = (): WebGLRenderingContext => ({
	isContextLost: () => true,
	getExtension: () => null,
	getParameter: () => 0,
	getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
}) as unknown as WebGLRenderingContext;

const make_fake_canvas = () => ({
	width: 0,
	height: 0,
	getContext: (kind: string) => kind === "webgl" || kind === "webgl2" ? make_lost_gl() : null,
	addEventListener: () => {},
	removeEventListener: () => {},
});

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

describe("flicker is deterministic", () => {
	test("torch_flicker is pure given (seed, t, amount)", () => {
		const a = torch_flicker(42, 1.234, 0.15);
		const b = torch_flicker(42, 1.234, 0.15);
		expect(a.intensity).toBe(b.intensity);
		expect(a.radius).toBe(b.radius);
	});

	test("torch_flicker intensity stays in roughly [0.7, 1.3]", () => {
		for (let i = 0; i < 200; i++) {
			const { intensity } = torch_flicker(7, i * 0.01, 0.15);
			expect(intensity).toBeGreaterThan(0.7);
			expect(intensity).toBeLessThan(1.3);
		}
	});

	test("torch_flicker varies with t", () => {
		const a = torch_flicker(1, 0, 0.15);
		const b = torch_flicker(1, 1, 0.15);
		expect(a.intensity).not.toBe(b.intensity);
	});

	test("torch_flicker varies with seed", () => {
		const a = torch_flicker(1, 0.5, 0.15);
		const b = torch_flicker(2, 0.5, 0.15);
		expect(a.intensity).not.toBe(b.intensity);
	});

	test("candle_flicker is pure given (seed, t, amount)", () => {
		const a = candle_flicker(3, 2.5, 0.15);
		const b = candle_flicker(3, 2.5, 0.15);
		expect(a.intensity).toBe(b.intensity);
		expect(a.radius).toBe(b.radius);
	});

	test("fluorescent_flicker steps at 10 Hz", () => {
		const a = fluorescent_flicker(0, 0.05);
		const b = fluorescent_flicker(0, 0.099);
		const c = fluorescent_flicker(0, 0.101);
		expect(a).toBe(b);
		expect(a).not.toBe(c);
	});

	test("sine_flicker matches closed form", () => {
		const v = sine_flicker(2, 0.1, 0.125);
		expect(v).toBeCloseTo(1 + Math.sin(0.125 * 2 * Math.PI * 2) * 0.1, 10);
	});
});

describe("presets cookbook", () => {
	test("has all 6 entries with expected shape", () => {
		const names = ["moon_cavern", "warm_torch", "frostbite", "lab", "sunset", "hellscape"] as const;
		for (const name of names) {
			const p = presets[name];
			expect(p.ambient.length).toBe(3);
			expect(p.default_torch_color.length).toBe(3);
			expect(typeof p.default_torch_radius).toBe("number");
		}
	});
});

describe("make_light_system", () => {
	const make = () => make_light_system({ grid: grid({ cols: 8, rows: 8, tile: 16 }) });

	test("returns a LightSystem with expected properties", () => {
		const ls = make();
		expect(typeof ls.add).toBe("function");
		expect(typeof ls.remove).toBe("function");
		expect(typeof ls.set_pos).toBe("function");
		expect(typeof ls.set_intensity).toBe("function");
		expect(typeof ls.set_color).toBe("function");
		expect(typeof ls.set_ambient).toBe("function");
		expect(typeof ls.update).toBe("function");
		expect(ls.filter).toBeDefined();
		expect(ls.eye_handle).toBeDefined();
	});

	test("eye_handle.id is 0", () => {
		const ls = make();
		expect(ls.eye_handle.id).toBe(0);
	});

	test("add() returns increasing handles", () => {
		const ls = make();
		const a = ls.add({
			pos_cell: [1, 1],
			color: [1, 1, 1],
			radius_cells: 3,
			intensity: 0.5,
		});
		const b = ls.add({
			pos_cell: [2, 2],
			color: [1, 1, 1],
			radius_cells: 3,
			intensity: 0.5,
		});
		expect(a.id).toBe(1);
		expect(b.id).toBe(2);
	});

	test("remove() of non-tail swap-pops", () => {
		const ls = make();
		const a = ls.add({ pos_cell: [1, 1], color: [1, 1, 1], radius_cells: 3, intensity: 0.5 });
		const b = ls.add({ pos_cell: [2, 2], color: [1, 1, 1], radius_cells: 3, intensity: 0.5 });
		const c = ls.add({ pos_cell: [3, 3], color: [1, 1, 1], radius_cells: 3, intensity: 0.5 });
		expect(a.id).toBe(1);
		expect(b.id).toBe(2);
		expect(c.id).toBe(3);
		ls.remove(a);
		expect(c.id).toBe(1);
		expect(b.id).toBe(2);
	});
});
