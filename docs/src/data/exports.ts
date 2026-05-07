export type ExportKind = "function" | "type" | "constant" | "component" | "factory" | "namespace" | "schema";

export interface ExportEntry {
	name: string;
	kind: ExportKind;
	signature?: string;
	description: string;
}

export interface ExportCategory {
	name: string;
	description?: string;
	exports: ExportEntry[];
}

export interface SubpathSection {
	subpath: string;
	description: string;
	categories: ExportCategory[];
}

export const sections: SubpathSection[] = [
	{
		subpath: "@f0rbit/forge",
		description: "Engine kernel — ECS, schedule, time, rng, resources, input, replay, anim, snapshot, palette, debug.",
		categories: [
			{
				name: "World",
				description: "Sparse-set ECS with typed components and queries.",
				exports: [
					{ name: "world", kind: "factory", signature: "() => World", description: "Create a fresh world. Returns { spawn, despawn, has, get, set, remove, query, count, ... }." },
					{ name: "component", kind: "factory", signature: "<T>(name: string) => Component<T>", description: "Create a typed component descriptor backed by a global symbol (Symbol.for)." },
					{ name: "internal", kind: "constant", signature: "unique symbol", description: "Escape-hatch key for World[internal]. Used by snapshot/restore and tests." },
					{ name: "pos_c", kind: "constant", signature: "Component<{ x: number; y: number }>", description: "Canonical position component used by PIXI sprite + anim sync systems." },
					{ name: "world.spawn_many", kind: "function", signature: "(count, factory) | (specs) => readonly Id[]", description: "Bulk-spawn entities. Two forms: `(count, factory)` calls `factory(i)` for `i` in `[0, count)`; `(specs[])` spawns one entity per element of the array. Returns ids in spawn order." },
					{ name: "world.despawn_marked", kind: "function", signature: "(...markers: readonly Component<any>[]) => number", description: "Bulk-despawn every entity that has ALL of the given marker components. Snapshots before mutating; safe to call mid-iteration of unrelated queries. Returns count despawned." },
					{ name: "world.query", kind: "function", signature: "<C>(cs: C, opts?: QueryOpts) => Query<C>", description: "Query the world. `Component<true>` markers are auto-elided from the yielded tuple, so the destructure shape is only the data components plus `Id`." },
					{ name: "World", kind: "type", description: "Core ECS interface returned by world()." },
					{ name: "Component", kind: "type", signature: "Component<T>", description: "Branded descriptor pairing a name, key, and data type." },
					{ name: "Id", kind: "type", description: "Branded number identifying an entity." },
					{ name: "Query", kind: "type", signature: "Query<C>", description: "Iterable query result with .each and .collect helpers. Marker components are elided from the yielded tuple." },
					{ name: "QueryOpts", kind: "type", signature: "{ without?: Component<any>[] }", description: "Optional excludes for query()." },
					{ name: "ComponentTuple", kind: "type", description: "Helper that maps a tuple of Component<T> to a tuple of T (markers elided)." },
					{ name: "SpawnFactory", kind: "type", signature: "(i: number) => readonly [Component<any>, any][]", description: "Factory passed to `spawn_many(count, factory)`." },
					{ name: "WorldInternal", kind: "type", description: "Escape-hatch interface exposing internal stores + `spawn_at` for snapshot/restore." },
				],
			},
			{
				name: "Schedule",
				description: "Insertion-ordered system runner with named stages.",
				exports: [
					{ name: "schedule", kind: "factory", signature: "() => Schedule", description: "Create a schedule. Default stages: startup, pre, update, post, render." },
					{ name: "schedule.add", kind: "function", signature: "(stage: Stage, sys: System, opts?: AddOpts | string) => Schedule", description: "Register a system. Pass a string for a name, or `{ every?, phase?, name? }` to gate by tick modulus. `every: 1` runs every tick; `every: N` runs every Nth tick offset by `phase`." },
					{ name: "Schedule", kind: "type", description: "{ add, remove, tick, run, stages }." },
					{ name: "Stage", kind: "type", signature: '"startup" | "pre" | "update" | "post" | "render" | string', description: "Built-in or custom stage name." },
					{ name: "System", kind: "type", signature: "(w: World, ctx: Ctx) => void", description: "A system function — receives the world and the per-tick context." },
					{ name: "AddOpts", kind: "type", signature: "{ every?: number; phase?: number; name?: string }", description: "Options for schedule.add. `every` gates the system to every Nth tick; `phase` offsets the gate so two periodic systems can interleave." },
					{ name: "Ctx", kind: "type", signature: "{ time, rng, res, input, debug, palette, store? }", description: "Per-tick context handed to every system." },
				],
			},
			{
				name: "Time",
				description: "Deterministic fixed-step time resource.",
				exports: [
					{ name: "time", kind: "factory", signature: "(opts?: { fixed_dt?: number }) => Time", description: "Create a time resource. Default fixed_dt = 1/60." },
					{ name: "Time", kind: "type", signature: "{ tick, fixed_dt, elapsed, alpha, scale, advance, restore }", description: "Fixed-step accumulator + scale + alpha." },
				],
			},
			{
				name: "RNG",
				description: "Seeded splittable random.",
				exports: [
					{ name: "rng", kind: "factory", signature: "(seed: number) => Rng", description: "Create a seeded RNG. Use .fork() for per-subsystem isolation." },
					{ name: "Rng", kind: "type", signature: "{ seed, next, int, pick, fork, state, restore }", description: "Splittable PRNG. Same seed + same call sequence = same output." },
				],
			},
			{
				name: "Resources",
				description: "Symbol-keyed registry for shared engine state.",
				exports: [
					{ name: "resources", kind: "factory", signature: "() => Resources", description: "Create a resources registry." },
					{ name: "resource", kind: "factory", signature: "<T>(name: string) => ResKey<T>", description: "Create a typed resource key (uses Symbol.for for cross-bundle identity)." },
					{ name: "Resources", kind: "type", description: "{ has, get, set, delete }." },
					{ name: "ResKey", kind: "type", signature: "ResKey<T>", description: "Typed key for resources.get/set." },
				],
			},
			{
				name: "Animation",
				description: "Per-entity sprite animation, atlas registry, and event buffer.",
				exports: [
					{ name: "anim", kind: "factory", signature: "() => Anim", description: "Animation system controller — play, stop, advance, snapshot." },
					{ name: "anim_c", kind: "constant", signature: "Component<AnimData>", description: "Per-entity animation state component. The `t` field is an internal accumulator (tracked for snapshot determinism); never read or write it from game code." },
					{ name: "atlas_registry_r", kind: "constant", signature: "ResKey<AtlasRegistry>", description: "Resource key for the registered atlas sequences. Renamed from `atlas_registry` in v0.3.0 for `_r` suffix consistency." },
					{ name: "anim_events_r", kind: "constant", signature: "ResKey<AnimEventBuffer>", description: "Resource key for the per-tick anim event buffer. Renamed from `anim_events` in v0.3.0 for `_r` suffix consistency." },
					{ name: "Anim", kind: "type", description: "Animation controller interface." },
					{ name: "AnimData", kind: "type", description: "Per-entity animation state (sequence, frame, time, speed). The `t` field is internal — used for snapshot/restore determinism only." },
					{ name: "AnimEvent", kind: "type", description: "Anim event union — frame_changed, finished, looped." },
					{ name: "AnimEventBuffer", kind: "type", description: "Per-tick buffer of animation events; cleared each schedule.tick." },
					{ name: "AtlasFrame", kind: "type", description: "Single frame in an atlas — texture alias + duration." },
					{ name: "AtlasRegistry", kind: "type", description: "Map of alias → AtlasSequences." },
					{ name: "AtlasSequences", kind: "type", description: "Map of sequence name → AtlasFrame[]." },
				],
			},
			{
				name: "Input",
				description: "Action-based input layer with bindings, sources, and rebinding.",
				exports: [
					{ name: "input", kind: "factory", signature: "(bindings?: Bindings) => Input", description: "Create an input system. Pair with a source via input.source(...)." },
					{ name: "noop_source", kind: "factory", signature: "() => InputSource", description: "Source that emits nothing — useful for tests." },
					{ name: "scripted", kind: "factory", signature: "(events) => InputSource", description: "Source that replays scripted RawInput events at given ticks." },
					{ name: "ticked", kind: "factory", signature: "(fn) => InputSource", description: "Wrap a per-tick function as an input source." },
					{ name: "empty_bindings", kind: "factory", signature: "() => Bindings", description: "Empty bindings object — { digital: {}, axes: {}, deadzone: 0.15 }." },
					{ name: "merge_bindings", kind: "factory", signature: "(...bs: Bindings[]) => Bindings", description: "Merge bindings layers; later layers override earlier." },
					{ name: "Input", kind: "type", description: "{ bind, source, advance, pressed, just_pressed, just_released, axis, vector, ... }." },
					{ name: "ActionState", kind: "type", description: "Per-action edge + value state." },
					{ name: "RawInput", kind: "type", description: "Raw event union — key, pad button, pad axis." },
					{ name: "InputSource", kind: "type", description: "{ poll, dispose? } interface for input producers." },
					{ name: "PadIndex", kind: "type", description: "Branded gamepad index (0–3)." },
					{ name: "Bindings", kind: "type", description: "{ digital, axes, deadzone } — declarative action map." },
					{ name: "Trigger", kind: "type", description: "Single digital trigger — key | pad.button | pad.axis." },
					{ name: "AxisBinding", kind: "type", description: "Single axis binding — key.pair | pad.axis | pad.button.pair." },
					{ name: "Action", kind: "type", description: "Action name string." },
				],
			},
			{
				name: "Replay",
				description: "Deterministic record/playback of action events.",
				exports: [
					{ name: "replay", kind: "namespace", signature: "{ record, play, save, load }", description: "Namespace bundling recorder, player, and save/load helpers. The schema lives at the top-level `replay_schema` export." },
					{ name: "replay_schema", kind: "schema", signature: "ZodType<ReplayDoc>", description: "Top-level Zod schema for a replay document. Use directly for validation or to derive types via `z.infer`." },
					{ name: "replay.record", kind: "function", signature: "(input: Input, ctx: Ctx, opts?: { seed?: number }) => Recorder", description: "Record action transitions into a `ReplayDoc`. Reads `seed`, `fixed_dt`, `get_tick` from `ctx`. A low-level overload `(input, { seed, fixed_dt, get_tick })` is available for tests without a `Ctx`." },
					{ name: "ReplayDoc", kind: "type", description: "Serialised replay document — meta + events." },
					{ name: "ActionEvent", kind: "type", description: "{ tick, action, kind, value? } event row." },
					{ name: "ReplayError", kind: "type", description: "Replay error union — parse, mismatch, etc." },
					{ name: "Recorder", kind: "type", description: "{ record, snapshot, dispose } recorder handle." },
					{ name: "Player", kind: "type", description: "{ apply, exhausted } player handle." },
				],
			},
			{
				name: "Snapshot",
				description: "Persistence kernel — serialise and restore world + resources.",
				exports: [
					{ name: "snapshotter", kind: "factory", signature: "(opts?) => Snapshotter", description: "Create a snapshotter. Provides take() and restore()." },
					{ name: "snapshot_schema", kind: "schema", signature: "ZodType<Snapshot>", description: "Zod schema for a snapshot document." },
					{ name: "Snapshot", kind: "type", description: "Serialised world + resources blob." },
					{ name: "SnapshotMeta", kind: "type", description: "{ version, created_at, ... } header." },
					{ name: "EntitySnap", kind: "type", description: "Per-entity row in a Snapshot." },
					{ name: "Snapshotter", kind: "type", description: "{ take, restore }." },
					{ name: "TakeOpts", kind: "type", description: "Options for snapshotter.take()." },
					{ name: "RestoreOpts", kind: "type", description: "Options for snapshotter.restore()." },
				],
			},
			{
				name: "Storage (re-exports)",
				description: "Convenience re-exports from @f0rbit/forge/storage.",
				exports: [
					{ name: "mem", kind: "factory", signature: "<T>(opts?: MemOpts<T>) => Store<T>", description: "In-memory Store<T> backend." },
					{ name: "file", kind: "factory", signature: "<T>(opts: FileOpts<T>) => Store<T>", description: "File-system Store<T> backend (Node)." },
					{ name: "store", kind: "factory", signature: "<T>(opts: StoreOpts<T>) => Store<T>", description: "Generic Store<T> with custom IO." },
					{ name: "save", kind: "function", signature: "(snapshotter, store, slot) => Promise<Result<void, SaveError>>", description: "Compose snapshotter + store: take a snapshot and persist it to a slot." },
					{ name: "load", kind: "function", signature: "(snapshotter, store, slot) => Promise<Result<void, SaveError>>", description: "Compose snapshotter + store: load a slot and restore the world." },
					{ name: "engine_store", kind: "factory", signature: "(opts?: EngineStoreOpts) => EngineStore", description: "Default engine store wrapping bindings + prefs persistence." },
					{ name: "bindings_schema", kind: "schema", description: "Zod schema for persisted Bindings." },
					{ name: "prefs_schema", kind: "schema", description: "Zod schema for persisted Prefs." },
					{ name: "default_prefs", kind: "constant", signature: "Prefs", description: "Sensible default preferences object." },
					{ name: "Store", kind: "type", signature: "Store<T>", description: "Generic persisted-store interface." },
					{ name: "Slot", kind: "type", description: "Branded slot identifier (string)." },
					{ name: "SaveHandle", kind: "type", description: "Handle returned by store.open(slot)." },
					{ name: "SaveSlot", kind: "type", description: "Slot + value pair." },
					{ name: "StoreError", kind: "type", description: "Store error union." },
					{ name: "MemOpts", kind: "type", description: "Options for mem()." },
					{ name: "FileOpts", kind: "type", description: "Options for file()." },
					{ name: "StoreOpts", kind: "type", description: "Options for store()." },
					{ name: "SaveError", kind: "type", description: "Error union for save/load." },
					{ name: "EngineStore", kind: "type", description: "Default-engine save layer." },
					{ name: "EngineStoreOpts", kind: "type", description: "Options for engine_store()." },
					{ name: "Prefs", kind: "type", description: "User-facing engine preferences." },
				],
			},
			{
				name: "Debug",
				description: "Frame-buffered draw commands, per-entity pins, and __DEV__ gating.",
				exports: [
					{ name: "debug", kind: "factory", signature: "(opts?: DebugOpts) => Debug", description: "Create a debug subsystem. Use __dev__ to toggle production no-op." },
					{ name: "debug_noop", kind: "factory", signature: "() => Debug", description: "No-op debug — drops every command. Used in production builds." },
					{ name: "is_dev", kind: "function", signature: "() => boolean", description: "Read the __DEV__ gate from the global." },
					{ name: "Debug", kind: "type", description: "{ line, rect, text, pin, unpin, frame, stats, ... }." },
					{ name: "DebugOpts", kind: "type", description: "Options for debug()." },
					{ name: "DebugCmd", kind: "type", description: "Frame-buffered draw command union." },
					{ name: "DebugStats", kind: "type", description: "{ entities, frame_ms, draw_calls, ... }." },
					{ name: "Pin", kind: "type", description: "Per-entity inspection pin." },
					{ name: "PinKind", kind: "type", description: "Pin classification — info, warn, error." },
					{ name: "Color", kind: "type", description: "Numeric RGB triple or named colour." },
					{ name: "Inspection", kind: "type", description: "Inspector snapshot for a single entity." },
					{ name: "ComponentInspection", kind: "type", description: "Per-component inspection row." },
				],
			},
			{
				name: "Palette",
				description: "Command palette — register, search, run.",
				exports: [
					{ name: "palette", kind: "factory", signature: "(opts?: PaletteOpts) => Palette", description: "Create a command palette controller." },
					{ name: "palette_noop", kind: "factory", signature: "() => Palette", description: "No-op palette for production." },
					{ name: "builtins", kind: "function", signature: "(deps: BuiltinDeps) => Command[]", description: "Built-in commands (toggle pause, set time scale, snapshot, ...)." },
					{ name: "tokenise", kind: "function", signature: "(line: string) => string[]", description: "Tokenise a palette command line." },
					{ name: "parse_line", kind: "function", signature: "(line: string) => ParsedLine", description: "Parse a tokenised line into command + args." },
					{ name: "fuzzy_score", kind: "function", signature: "(query: string, target: string) => number", description: "Fuzzy match score (0..1)." },
					{ name: "fuzzy_rank", kind: "function", signature: "(query, items) => SearchHit[]", description: "Rank items by fuzzy score against a query." },
					{ name: "Palette", kind: "type", description: "{ register, run, search, history, ... }." },
					{ name: "PaletteOpts", kind: "type", description: "Options for palette()." },
					{ name: "Command", kind: "type", signature: "Command<A>", description: "Registered command — id, label, run." },
					{ name: "CommandError", kind: "type", description: "Command run error." },
					{ name: "CommandRunner", kind: "type", signature: "CommandRunner<A>", description: "(args: A, ctx: Ctx) => Result<void, CommandError>." },
					{ name: "SearchHit", kind: "type", description: "Search result row — { id, score }." },
					{ name: "BuiltinDeps", kind: "type", description: "Dependencies needed by builtins()." },
					{ name: "ParsedLine", kind: "type", description: "{ command, args } parsed from a palette line." },
				],
			},
			{
				name: "Math",
				description: "Tiny vector helpers.",
				exports: [
					{ name: "vec2", kind: "factory", signature: "(x: number, y: number) => Vec2", description: "Create a Vec2 record." },
					{ name: "Vec2", kind: "type", signature: "{ x: number; y: number }", description: "Plain 2D vector record." },
				],
			},
			{
				name: "Errors",
				description: "Engine-wide error union.",
				exports: [
					{ name: "EngineError", kind: "type", description: "Discriminated union of every kernel error kind. Used in Result<T, EngineError>." },
				],
			},
			{
				name: "Test harness",
				description: "Headless test driver — run schedules, assert, snapshot.",
				exports: [
					{ name: "harness", kind: "factory", signature: "(opts?: HarnessOpts) => Harness", description: "Create a headless harness for integration tests. Wires world, schedule, time, rng, resources, input." },
					{ name: "Harness", kind: "type", description: "{ world, schedule, time, rng, res, input, tick, run, dispose }." },
					{ name: "HarnessOpts", kind: "type", description: "Options for harness() — seed, fixed_dt, bindings, resources." },
				],
			},
			{
				name: "Version",
				exports: [
					{ name: "VERSION", kind: "constant", signature: '"0.0.1"', description: "Compile-time package version constant." },
				],
			},
		],
	},
	{
		subpath: "@f0rbit/forge/pixi",
		description: "PIXI v8 integration — boot(), camera, sprite + anim sync, palette UI, debug overlay. The only subpath allowed to import pixi.js.",
		categories: [
			{
				name: "Boot",
				description: "Wire-up factory that returns a fully-composed App.",
				exports: [
					{ name: "boot", kind: "factory", signature: "(opts: BootOpts) => Promise<Result<App, BootError>>", description: "Mount, wire renderer + camera + assets + input + palette + debug, return a started App." },
					{ name: "App", kind: "type", description: "Started application handle — { world, schedule, ..., tick, start, stop, dispose }." },
					{ name: "BootOpts", kind: "type", description: "Boot options — mount, camera, bindings, assets, dev gate, optional overrides." },
					{ name: "BootError", kind: "type", description: "Boot error union — mount_not_found, render_failed, asset_failed." },
					{ name: "AssetSpec", kind: "type", description: "{ kind: 'image' | 'atlas', alias, url } asset descriptor." },
				],
			},
			{
				name: "Assets",
				description: "PIXI asset loader with atlas registry integration.",
				exports: [
					{ name: "assets", kind: "factory", signature: "(opts?: AssetsOpts) => Assets", description: "Create the asset loader. Provides load(kind, alias, url), texture(alias), atlas(alias), registry()." },
					{ name: "assets.load", kind: "function", signature: "<K extends AssetKind>(kind: K, alias: string, url: string) => Promise<Result<LoadValue<K>, AssetError>>", description: "Async loader unified by `kind` discriminator. `kind: 'image'` returns `Texture`; `kind: 'atlas'` returns `Spritesheet`. Replaces the old separate `image()`/`atlas()` async loaders." },
					{ name: "assets.texture", kind: "function", signature: "(alias: string) => Result<Texture, AssetError>", description: "Synchronous getter for a previously-loaded image. `kind: 'not_loaded'` if the alias is unknown." },
					{ name: "assets.atlas", kind: "function", signature: "(alias: string) => Result<Spritesheet, AssetError>", description: "Synchronous getter for a previously-loaded atlas. `kind: 'not_loaded'` if the alias is unknown." },
					{ name: "Assets", kind: "type", description: "{ load, texture, atlas, get, has, register_atlas, registry, dispose }." },
					{ name: "AssetsOpts", kind: "type", description: "{ fixed_dt, register_default? } options." },
					{ name: "AssetKind", kind: "type", signature: '"image" | "atlas"', description: "Discriminator for `assets.load`." },
					{ name: "LoadValue", kind: "type", signature: "LoadValue<K> = K extends 'image' ? Texture : Spritesheet", description: "Conditional return type for `assets.load<K>`." },
					{ name: "AssetError", kind: "type", description: "Asset error union — load_failed, not_loaded, invalid_atlas, wrong_kind." },
				],
			},
			{
				name: "Browser source",
				description: "Keyboard + Gamepad + (optional) pointer InputSource.",
				exports: [
					{ name: "browser_source", kind: "factory", signature: "(opts?: BrowserSourceOpts) => BrowserSource", description: "InputSource that polls keyboard + Gamepad API." },
					{ name: "BrowserSource", kind: "type", description: "{ poll, dispose }." },
					{ name: "BrowserSourceOpts", kind: "type", description: "{ deadzone?, get_time? } options." },
				],
			},
			{
				name: "Camera",
				description: "Design-resolution camera with letterbox/stretch/integer modes.",
				exports: [
					{ name: "camera", kind: "factory", signature: "(opts: CameraOpts) => Camera", description: "Create a camera. Modes: letterbox, stretch, integer, fit." },
					{ name: "Camera", kind: "type", description: "{ resize, viewport, set_mode, design, ... }." },
					{ name: "CameraOpts", kind: "type", description: "{ design: { width, height }, mode } options." },
					{ name: "CameraMode", kind: "type", signature: '"letterbox" | "stretch" | "integer" | "fit"', description: "Camera scaling mode." },
					{ name: "Viewport", kind: "type", description: "{ x, y, w, h, scale } resolved viewport rect." },
				],
			},
			{
				name: "Render",
				description: "Application + stage + overlay layers.",
				exports: [
					{ name: "make_render", kind: "factory", signature: "(opts: RenderOpts) => Promise<Result<RenderState, RenderError>>", description: "Initialise the PIXI Application and overlay containers." },
					{ name: "RenderState", kind: "type", description: "{ app, world, debug_overlay, palette_overlay, render_system, canvas, dispose }." },
					{ name: "RenderError", kind: "type", description: "Render init error — webgl_unavailable, ..." },
					{ name: "RenderOpts", kind: "type", description: "{ mount, camera } options." },
				],
			},
			{
				name: "Sprite",
				description: "ECS↔PIXI sprite bridge.",
				exports: [
					{ name: "sprite_c", kind: "constant", signature: "Component<SpriteData>", description: "Per-entity sprite component (texture, frame, anchor, tint, scale, visibility)." },
					{ name: "sprite_sync_system", kind: "factory", signature: "(opts: SpriteSystemOpts) => System", description: "System that syncs sprite_c to PIXI display objects each post-tick. Applies texture/frame, anchor, tint, scale, position, zIndex. Owns the `WeakMap<World, Map<Id, Sprite>>` keeping live PIXI nodes." },
					{ name: "sprite", kind: "namespace", signature: "{ set, show, hide }", description: "Patch helpers for `sprite_c` — `sprite.set(w, id, patch)` merges a `Partial<SpriteData>` into the existing component (no spread ceremony). `sprite.show`/`hide` toggle `visible`." },
					{ name: "sprite.set", kind: "function", signature: "(w: World, id: Id, patch: Partial<SpriteData>) => Result<void, EngineError>", description: "Read the entity's `sprite_c`, merge `patch`, write back. Errors `component_missing` if the entity has no sprite." },
					{ name: "sprite.show", kind: "function", signature: "(w: World, id: Id) => Result<void, EngineError>", description: "Shortcut for `sprite.set(w, id, { visible: true })`." },
					{ name: "sprite.hide", kind: "function", signature: "(w: World, id: Id) => Result<void, EngineError>", description: "Shortcut for `sprite.set(w, id, { visible: false })`." },
					{ name: "SpriteData", kind: "type", description: "Config-only: `{ texture, frame?, anchor?, tint?, visible?, z?, scale? }`. The PIXI runtime node is owned by `sprite_sync_system` (private `WeakMap`); no `node` field on the public type." },
					{ name: "SpriteData.scale", kind: "type", signature: "{ x: number; y: number }", description: "Optional non-uniform scale applied to the underlying PIXI Sprite each frame. Defaults to (1,1). Use for HUD vs world sprite ratios, pixel-perfect upscale, mirroring (`{ x: -1, y: 1 }`)." },
					{ name: "SpriteSystemOpts", kind: "type", description: "{ assets, world_container, pos_component } options." },
				],
			},
			{
				name: "Anim",
				description: "Animation sync — drives sprite frames from anim_c.",
				exports: [
					{ name: "anim_sync_system", kind: "factory", signature: "(opts: AnimPixiOpts) => System", description: "System that reads anim_c, advances frames, writes back to sprite_c." },
					{ name: "AnimPixiOpts", kind: "type", description: "{ assets } options." },
				],
			},
			{
				name: "Debug overlay",
				description: "Renders frame-buffered debug commands into a PIXI overlay.",
				exports: [
					{ name: "debug_pixi", kind: "factory", signature: "(opts: DebugPixiOpts) => System", description: "System that renders Debug.frame() commands into the debug overlay each render-tick." },
					{ name: "DebugPixiOpts", kind: "type", description: "{ overlay, dev? } options." },
				],
			},
			{
				name: "Palette UI",
				description: "PIXI overlay UI for the command palette.",
				exports: [
					{ name: "palette_pixi", kind: "factory", signature: "(opts: PalettePixiOpts) => { system: System, dispose: () => void }", description: "Mount a PIXI palette overlay; returns the per-frame system + dispose." },
					{ name: "PalettePixiOpts", kind: "type", description: "{ overlay, palette, get_ctx } options." },
				],
			},
		],
	},
	{
		subpath: "@f0rbit/forge/debug",
		description: "Standalone debug subsystem (also re-exported from the main entry).",
		categories: [
			{
				name: "Factories",
				exports: [
					{ name: "debug", kind: "factory", signature: "(opts?: DebugOpts) => Debug", description: "Create a debug subsystem." },
					{ name: "debug_noop", kind: "factory", signature: "() => Debug", description: "No-op debug for production." },
					{ name: "is_dev", kind: "function", signature: "() => boolean", description: "Read the __DEV__ global." },
				],
			},
			{
				name: "Types",
				exports: [
					{ name: "Debug", kind: "type", description: "{ line, rect, text, pin, unpin, frame, stats, ... }." },
					{ name: "DebugOpts", kind: "type", description: "Options for debug()." },
					{ name: "Color", kind: "type", description: "Numeric RGB triple or named colour." },
					{ name: "DebugCmd", kind: "type", description: "Frame-buffered draw command union." },
					{ name: "DebugStats", kind: "type", description: "{ entities, frame_ms, draw_calls, ... }." },
					{ name: "Pin", kind: "type", description: "Per-entity inspection pin." },
					{ name: "PinKind", kind: "type", description: "Pin classification." },
					{ name: "ComponentInspection", kind: "type", description: "Per-component inspection row." },
					{ name: "Inspection", kind: "type", description: "Inspector snapshot." },
				],
			},
		],
	},
	{
		subpath: "@f0rbit/forge/storage",
		description: "Persistence subsystem — snapshotter, generic Store<T>, save/load helpers, default engine store.",
		categories: [
			{
				name: "Snapshot",
				exports: [
					{ name: "snapshotter", kind: "factory", signature: "(opts?) => Snapshotter", description: "Create a snapshotter." },
					{ name: "snapshot_schema", kind: "schema", description: "Zod schema for snapshots." },
					{ name: "Snapshot", kind: "type", description: "Serialised world + resources." },
					{ name: "SnapshotMeta", kind: "type", description: "Snapshot header." },
					{ name: "EntitySnap", kind: "type", description: "Per-entity row." },
					{ name: "Snapshotter", kind: "type", description: "{ take, restore }." },
					{ name: "TakeOpts", kind: "type", description: "Options for take()." },
					{ name: "RestoreOpts", kind: "type", description: "Options for restore()." },
				],
			},
			{
				name: "Backends",
				description: "Store<T> implementations.",
				exports: [
					{ name: "mem", kind: "factory", signature: "<T>(opts?: MemOpts<T>) => Store<T>", description: "In-memory backend — useful for tests." },
					{ name: "file", kind: "factory", signature: "<T>(opts: FileOpts<T>) => Store<T>", description: "File-system backend (Node)." },
					{ name: "store", kind: "factory", signature: "<T>(opts: StoreOpts<T>) => Store<T>", description: "Generic backend with custom read/write." },
					{ name: "Store", kind: "type", signature: "Store<T>", description: "{ open, save, load, list, delete }." },
					{ name: "Slot", kind: "type", description: "Branded slot identifier." },
					{ name: "SaveHandle", kind: "type", description: "Slot handle." },
					{ name: "SaveSlot", kind: "type", description: "Slot + value pair." },
					{ name: "StoreError", kind: "type", description: "Store error union." },
					{ name: "MemOpts", kind: "type", description: "Options for mem()." },
					{ name: "FileOpts", kind: "type", description: "Options for file()." },
					{ name: "StoreOpts", kind: "type", description: "Options for store()." },
				],
			},
			{
				name: "Save / load",
				exports: [
					{ name: "save", kind: "function", signature: "(snapshotter, store, slot) => Promise<Result<void, SaveError>>", description: "Compose snapshotter + store: persist current world to a slot." },
					{ name: "load", kind: "function", signature: "(snapshotter, store, slot) => Promise<Result<void, SaveError>>", description: "Compose snapshotter + store: load a slot back into the world." },
					{ name: "SaveError", kind: "type", description: "Error union for save/load." },
				],
			},
			{
				name: "Engine store",
				description: "Bindings + prefs persistence layer used by boot().",
				exports: [
					{ name: "engine_store", kind: "factory", signature: "(opts?: EngineStoreOpts) => EngineStore", description: "Default engine save layer wrapping bindings + prefs." },
					{ name: "bindings_schema", kind: "schema", description: "Zod schema for persisted Bindings." },
					{ name: "prefs_schema", kind: "schema", description: "Zod schema for persisted Prefs." },
					{ name: "default_prefs", kind: "constant", signature: "Prefs", description: "Sensible default Prefs object." },
					{ name: "EngineStore", kind: "type", description: "{ bindings, prefs } persistence handle." },
					{ name: "EngineStoreOpts", kind: "type", description: "Options for engine_store()." },
					{ name: "Prefs", kind: "type", description: "User-facing engine preferences." },
				],
			},
		],
	},
	{
		subpath: "@f0rbit/forge/grid",
		description: "Grid-game primitives — pure cell math, Bresenham line, line-of-sight FOV, cell-keyed spatial index, axis-sliding tile movement, and tick/cell-rate calibration. Tree-shakeable; non-grid consumers pay nothing.",
		categories: [
			{
				name: "Grid",
				description: "Cell math factory + spatial methods on the returned `Grid` record.",
				exports: [
					{ name: "grid", kind: "factory", signature: "(opts: GridOpts) => Grid", description: "Build a Grid record bundling cell↔world conversion, key/unkey, neighbours, distances, and the spatial methods (line, line_of_sight, move_tile)." },
					{ name: "grid.line", kind: "function", signature: "(a: Cell, b: Cell) => Generator<Cell>", description: "Bresenham line generator yielding every cell from `a` to `b` inclusive. Method on `Grid` — call as `g.line(a, b)`." },
					{ name: "grid.line_of_sight", kind: "function", signature: "(opts: FovOpts) => ReadonlySet<number>", description: "Symmetric Bresenham FOV — returns visible cell-keys from `opts.from` within Chebyshev radius. Method on `Grid` — call as `g.line_of_sight({...})`." },
					{ name: "grid.move_tile", kind: "function", signature: "<P>(w: World, id: Id, dir: { dx, dy }, opts: TileMoveOpts<P>) => Result<TileMoveResult, EngineError>", description: "Step entity one cell with axis-sliding collision. Method on `Grid`. `opts.pos` defaults to forge's canonical `pos_c`; pass it for custom position components." },
					{ name: "Cell", kind: "type", signature: "{ readonly x: number; readonly y: number }", description: "Integer-coordinate cell. Value object — pass by value." },
					{ name: "Grid", kind: "type", signature: "{ cols, rows, tile, key, unkey, in_bounds, cell_to_world, world_to_cell, chebyshev, manhattan, neighbors4, neighbors8, line, line_of_sight, move_tile }", description: "Grid helper bundle returned by grid()." },
					{ name: "GridOpts", kind: "type", signature: "{ cols: number; rows: number; tile: number }", description: "Options for grid() — `tile` is pixels per cell (square tiles)." },
					{ name: "FovOpts", kind: "type", signature: "{ from: Cell; radius: number; is_blocking: (cell: Cell) => boolean; include_origin?: boolean }", description: "Options for `grid.line_of_sight`. `include_origin` defaults to true. (No `grid` field — the method closes over the receiver.)" },
					{ name: "TileMoveOpts", kind: "type", signature: "{ blocked_by: (cell: Cell) => boolean; slide?: boolean; pos?: Component<P> }", description: "Options for `grid.move_tile`. `slide` defaults to true. `pos` defaults to forge's `pos_c`; override for custom position components." },
					{ name: "TileMoveResult", kind: "type", signature: "{ from: Cell; to: Cell; moved: boolean }", description: "Result of `grid.move_tile` — gives consumers the resolved cell so they can react (e.g. did I just step onto the exit?)." },
				],
			},
			{
				name: "Spatial index",
				description: "Cell-keyed spatial lookup over an entity component.",
				exports: [
					{ name: "grid_index", kind: "factory", signature: "<P>(w: World, pos_c: Component<P>, grid: Grid, filter?: Component<any>) => GridIndex", description: "Build a cell-keyed spatial index over entities with `pos_c`. Optional marker `filter` restricts the indexed set. Eagerly refreshes on construction." },
					{ name: "grid_index_sync_system", kind: "factory", signature: "(idx: GridIndex) => System", description: "System that calls `idx.refresh()` once per tick. Add to `pre` so subsequent systems see fresh lookups." },
					{ name: "GridIndex", kind: "type", signature: "{ at, all_at, around, refresh }", description: "Spatial index interface — `at(cell)` first match, `all_at(cell)` all matches, `around(cell, r)` everything in a Chebyshev-r square, `refresh()` rebuild." },
				],
			},
			{
				name: "Timing",
				description: "Calibrate movement speed in cells/sec instead of ticks-per-step.",
				exports: [
					{ name: "ticks_per_step", kind: "function", signature: "(cells_per_second: number, fixed_dt: number) => number", description: "Convert a desired cells-per-second to the integer tick gate. Decouples movement speed from grid resolution." },
				],
			},
		],
	},
	{
		subpath: "@f0rbit/forge/presets",
		description: "Pre-built Bindings for common control schemes — hand to boot() or merge with custom bindings.",
		categories: [
			{
				name: "Built-in presets",
				description: "Each preset is a Bindings object covering keyboard + gamepad.",
				exports: [
					{ name: "presets.movement_2d", kind: "constant", signature: "Bindings", description: "2D analogue movement: move.x, move.y axes (WASD / arrows / left stick / d-pad). Renamed from `movement2d` in v0.3.0." },
					{ name: "presets.movement_4way", kind: "constant", signature: "Bindings", description: "4-way digital-only movement: move.{left,right,up,down}. No axes — ideal for tile-step games. Renamed from `movement_4way_digital` in v0.3.0." },
					{ name: "presets.movement_8way", kind: "constant", signature: "Bindings", description: "8-way digital movement: move.{left,right,up,down} digital + move.x, move.y axes. Renamed from `movement8way` in v0.3.0." },
					{ name: "presets.platformer", kind: "constant", signature: "Bindings", description: "Side-scroller: jump (digital, Space / pad south) + move.x axis." },
					{ name: "presets.twinstick", kind: "constant", signature: "Bindings", description: "Twin-stick shooter: move.x, move.y, aim.x, aim.y axes." },
					{ name: "presets.menu", kind: "constant", signature: "Bindings", description: "Menu navigation: up, down, left, right, confirm, cancel digital actions." },
				],
			},
		],
	},
];

const total_exports = sections.reduce(
	(acc, s) => acc + s.categories.reduce((c, cat) => c + cat.exports.length, 0),
	0,
);

export const sectionsBySubpath = new Map(sections.map(s => [s.subpath, s]));

export const totalExportCount = total_exports;
