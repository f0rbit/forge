export type EngineError =
	| { kind: "entity_not_found"; id: number }
	| { kind: "component_missing"; id: number; component: string }
	| { kind: "resource_missing"; resource: string }
	| { kind: "empty_array" }
	| { kind: "unknown_sequence"; atlas: string; sequence: string }
	| { kind: "no_atlas_registered"; atlas: string }
	| { kind: "snapshot_validation_failed"; issues: readonly string[] }
	| { kind: "snapshot_version_mismatch"; expected: number; got: number }
	| { kind: "component_not_registered"; component: string }
	| { kind: "resource_not_registered"; resource: string };
