import type { Vec2 } from "../math.ts";
import type { Id } from "../world.ts";

export type Color = string;

export type DebugCmd =
	| { kind: "line"; a: Vec2; b: Vec2; color: Color }
	| { kind: "circle"; center: Vec2; r: number; color: Color }
	| { kind: "rect"; x: number; y: number; w: number; h: number; color: Color }
	| { kind: "text"; pos: Vec2; text: string; color: Color };

export type PinKind = "label" | "box" | "arrow";

export type Pin = {
	id: Id;
	kind: PinKind;
	data: unknown;
	ttl: number;
	added_tick: number;
};

export type DebugStats = {
	tick: number;
	entities: number;
	fps: number;
	tscale: number;
	system_us: Record<string, number>;
};

export type ComponentInspection = { name: string; data: unknown };

export type Inspection = {
	entity: Id;
	components: readonly ComponentInspection[];
};
