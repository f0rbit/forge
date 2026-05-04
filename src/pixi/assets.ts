import { ok, err, type Result } from "@f0rbit/corpus";
import { Assets, BufferImageSource, Spritesheet, Texture } from "pixi.js";
import type { AtlasRegistry, AtlasSequences } from "../anim.ts";

export type AssetError =
	| { kind: "load_failed"; alias: string; url: string; cause: string }
	| { kind: "not_loaded"; alias: string }
	| { kind: "invalid_atlas"; alias: string; issues: readonly string[] }
	| { kind: "wrong_kind"; alias: string; expected: string };

export type AtlasJson = {
	frames: Record<string, { frame: { x: number; y: number; w: number; h: number }; duration?: number; sourceSize?: { w: number; h: number }; spriteSourceSize?: { x: number; y: number; w: number; h: number } }>;
	animations?: Record<string, readonly string[]>;
	meta: { image?: string; format?: string; size?: { w: number; h: number }; scale?: number | string };
};

export type Assets_ = {
	image: (alias: string, url: string) => Promise<Result<Texture, AssetError>>;
	atlas: (alias: string, url: string) => Promise<Result<Spritesheet, AssetError>>;
	texture: (alias: string) => Result<Texture, AssetError>;
	get: <T>(alias: string) => Result<T, AssetError>;
	has: (alias: string) => boolean;
	register_atlas: (alias: string, sheet: Spritesheet) => Result<void, AssetError>;
	registry: () => AtlasRegistry;
	dispose: () => void;
};

const DEFAULT_FRAME_TICKS = 5;

const ms_to_ticks = (ms: number | undefined, fixed_dt: number): number => {
	if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return DEFAULT_FRAME_TICKS;
	const ticks = Math.round((ms / 1000) / fixed_dt);
	return Math.max(1, ticks);
};

const validate_atlas_json = (alias: string, json: unknown): Result<AtlasJson, AssetError> => {
	if (!json || typeof json !== "object") {
		return err({ kind: "invalid_atlas", alias, issues: ["root is not an object"] });
	}
	const j = json as Record<string, unknown>;
	const frames = j["frames"];
	if (!frames || typeof frames !== "object") {
		return err({ kind: "invalid_atlas", alias, issues: ["frames missing or not an object"] });
	}
	const meta = j["meta"];
	if (!meta || typeof meta !== "object") {
		return err({ kind: "invalid_atlas", alias, issues: ["meta missing or not an object"] });
	}
	for (const [name, fr] of Object.entries(frames)) {
		if (!fr || typeof fr !== "object") {
			return err({ kind: "invalid_atlas", alias, issues: [`frame ${name} not an object`] });
		}
		const f = (fr as Record<string, unknown>)["frame"];
		if (!f || typeof f !== "object") {
			return err({ kind: "invalid_atlas", alias, issues: [`frame ${name}.frame missing`] });
		}
	}
	return ok(json as AtlasJson);
};

export const compile_sequences = (json: AtlasJson, fixed_dt: number): AtlasSequences => {
	const out: Record<string, { frame: string; ticks: number }[]> = {};
	const animations = json.animations ?? {};
	for (const [seq_name, frame_names] of Object.entries(animations)) {
		const compiled: { frame: string; ticks: number }[] = [];
		for (const name of frame_names) {
			const meta = json.frames[name];
			const ticks = ms_to_ticks(meta?.duration, fixed_dt);
			compiled.push({ frame: name, ticks });
		}
		out[seq_name] = compiled;
	}
	if (Object.keys(out).length === 0) {
		const single: { frame: string; ticks: number }[] = [];
		for (const [name, meta] of Object.entries(json.frames)) {
			single.push({ frame: name, ticks: ms_to_ticks(meta.duration, fixed_dt) });
		}
		if (single.length > 0) out["__all__"] = single;
	}
	return out;
};

const DEFAULT_ATLAS_ALIAS = "__default__";

const make_default_pixels = (): Uint8Array => {
	const W = 64;
	const H = 16;
	const data = new Uint8Array(W * H * 4);
	const colors: readonly [number, number, number, number][] = [
		[255, 0, 255, 255],
		[0, 255, 255, 255],
		[255, 255, 0, 255],
		[0, 0, 0, 255],
	];
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const cell = Math.floor(x / 16);
			const c = colors[cell] ?? colors[0];
			const i = (y * W + x) * 4;
			data[i + 0] = c![0];
			data[i + 1] = c![1];
			data[i + 2] = c![2];
			data[i + 3] = c![3];
		}
	}
	return data;
};

export const default_atlas_json = (): AtlasJson => ({
	frames: {
		"__default_0__": { frame: { x: 0, y: 0, w: 16, h: 16 }, duration: 100 },
		"__default_1__": { frame: { x: 16, y: 0, w: 16, h: 16 }, duration: 100 },
		"__default_2__": { frame: { x: 32, y: 0, w: 16, h: 16 }, duration: 100 },
		"__default_3__": { frame: { x: 48, y: 0, w: 16, h: 16 }, duration: 100 },
	},
	animations: {
		spin: ["__default_0__", "__default_1__", "__default_2__", "__default_3__"],
	},
	meta: {
		image: "__default__.png",
		format: "RGBA8888",
		size: { w: 64, h: 16 },
		scale: 1,
	},
});

const make_default_texture = (): Result<Texture, AssetError> => {
	try {
		const pixels = make_default_pixels();
		const source = new BufferImageSource({ resource: pixels, width: 64, height: 16, alphaMode: "premultiply-alpha-on-upload" });
		const texture = new Texture({ source });
		return ok(texture);
	} catch (e) {
		return err({ kind: "load_failed", alias: DEFAULT_ATLAS_ALIAS, url: "<inline>", cause: (e as Error).message ?? String(e) });
	}
};

export const make_default_spritesheet = (): Result<Spritesheet, AssetError> => {
	const tex_r = make_default_texture();
	if (!tex_r.ok) return tex_r;
	try {
		const sheet = new Spritesheet(tex_r.value, default_atlas_json() as never);
		sheet.parseSync();
		return ok(sheet);
	} catch (e) {
		return err({ kind: "load_failed", alias: DEFAULT_ATLAS_ALIAS, url: "<inline>", cause: (e as Error).message ?? String(e) });
	}
};

export type AssetsOpts = {
	fixed_dt?: number;
	register_default?: boolean;
};

type Entry =
	| { kind: "image"; alias: string; texture: Texture }
	| { kind: "atlas"; alias: string; sheet: Spritesheet };

export const assets = (opts?: AssetsOpts): Assets_ => {
	const fixed_dt = opts?.fixed_dt ?? 1 / 60;
	const register_default = opts?.register_default ?? true;
	const cache = new Map<string, Entry>();
	const registry: AtlasRegistry = {};

	const register_atlas_internal = (alias: string, sheet: Spritesheet): Result<void, AssetError> => {
		const data = sheet.data as unknown as AtlasJson;
		const valid = validate_atlas_json(alias, data);
		if (!valid.ok) return valid;
		registry[alias] = compile_sequences(valid.value, fixed_dt);
		cache.set(alias, { kind: "atlas", alias, sheet });
		return ok(undefined);
	};

	if (register_default) {
		const def = make_default_spritesheet();
		if (def.ok) register_atlas_internal(DEFAULT_ATLAS_ALIAS, def.value);
	}

	const load_image = async (alias: string, url: string): Promise<Result<Texture, AssetError>> => {
		try {
			Assets.add({ alias, src: url });
			const value = await Assets.load(alias);
			if (!(value instanceof Texture)) {
				return err({ kind: "wrong_kind", alias, expected: "Texture" });
			}
			cache.set(alias, { kind: "image", alias, texture: value });
			return ok(value);
		} catch (e) {
			return err({ kind: "load_failed", alias, url, cause: (e as Error).message ?? String(e) });
		}
	};

	const load_atlas = async (alias: string, url: string): Promise<Result<Spritesheet, AssetError>> => {
		try {
			Assets.add({ alias, src: url });
			const value = await Assets.load(alias);
			if (!(value instanceof Spritesheet)) {
				return err({ kind: "wrong_kind", alias, expected: "Spritesheet" });
			}
			const r = register_atlas_internal(alias, value);
			if (!r.ok) return r;
			return ok(value);
		} catch (e) {
			return err({ kind: "load_failed", alias, url, cause: (e as Error).message ?? String(e) });
		}
	};

	return {
		image: load_image,
		atlas: load_atlas,
		texture: alias => {
			const e = cache.get(alias);
			if (!e) return err({ kind: "not_loaded", alias });
			if (e.kind === "image") return ok(e.texture);
			return err({ kind: "wrong_kind", alias, expected: "Texture" });
		},
		get: <T>(alias: string): Result<T, AssetError> => {
			const e = cache.get(alias);
			if (!e) return err({ kind: "not_loaded", alias });
			if (e.kind === "image") return ok(e.texture as unknown as T);
			return ok(e.sheet as unknown as T);
		},
		has: alias => cache.has(alias),
		register_atlas: register_atlas_internal,
		registry: () => registry,
		dispose: () => {
			cache.clear();
			for (const k of Object.keys(registry)) delete registry[k];
		},
	};
};

export const DEFAULT_ATLAS = DEFAULT_ATLAS_ALIAS;
