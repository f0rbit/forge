import { create_file_backend } from "@f0rbit/corpus/file";
import { z } from "zod";
import { store, type StoreOpts } from "./store.ts";
import type { Store } from "./types.ts";

export type FileOpts<T> = {
	dir: string;
	schema: z.ZodType<T>;
	id?: string;
};

export const file = <T>(opts: FileOpts<T>): Store<T> => {
	const store_opts: StoreOpts<T> = {
		backend: create_file_backend({ base_path: opts.dir }),
		schema: opts.schema,
		id: opts.id,
	};
	return store(store_opts);
};
