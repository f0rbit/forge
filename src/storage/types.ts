import type { Result } from "@f0rbit/corpus";

export type Slot = string;

export type SaveHandle = {
	slot: Slot;
	version: string;
	content_hash: string;
	created_at: Date;
	parent: SaveHandle | null;
};

export type SaveSlot = {
	slot: Slot;
	latest: SaveHandle;
};

export type StoreError =
	| { kind: "not_found"; slot: Slot }
	| { kind: "invalid_data"; issues: readonly string[] }
	| { kind: "serialisation_failed"; cause: string }
	| { kind: "backend_error"; operation: string; cause: string };

export type Store<T> = {
	save: (slot: Slot, value: T) => Promise<Result<SaveHandle, StoreError>>;
	load: (slot: Slot) => Promise<Result<T, StoreError>>;
	list: () => Promise<Result<readonly SaveSlot[], StoreError>>;
	remove: (slot: Slot) => Promise<Result<void, StoreError>>;
	has: (slot: Slot) => Promise<boolean>;
	history: (slot: Slot) => AsyncIterable<SaveHandle>;
};
