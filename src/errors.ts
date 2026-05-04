export type EngineError =
	| { kind: "entity_not_found"; id: number }
	| { kind: "component_missing"; id: number; component: string }
	| { kind: "resource_missing"; resource: string }
	| { kind: "empty_array" }
	| { kind: "unknown_sequence"; atlas: string; sequence: string }
	| { kind: "no_atlas_registered"; atlas: string };
