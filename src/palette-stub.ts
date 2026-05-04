export type Palette = {
	register: (...args: unknown[]) => void;
	unregister: (name: string) => void;
	list: () => readonly unknown[];
	exec: (...args: unknown[]) => Promise<unknown>;
	open: () => boolean;
	toggle: () => void;
};

export const palette_noop = (): Palette => {
	let opened = false;
	return {
		register: () => {},
		unregister: () => {},
		list: () => [],
		exec: async () => undefined,
		open: () => opened,
		toggle: () => {
			opened = !opened;
		},
	};
};
