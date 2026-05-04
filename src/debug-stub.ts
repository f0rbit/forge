export type Debug = {
	enabled: () => boolean;
	toggle: () => void;
	line: (...args: unknown[]) => void;
	circle: (...args: unknown[]) => void;
	rect: (...args: unknown[]) => void;
	label: (...args: unknown[]) => void;
	counter: (name: string, value: number | string) => void;
	drain: () => readonly unknown[];
};

export const debug_noop = (): Debug => {
	let on = false;
	return {
		enabled: () => on,
		toggle: () => {
			on = !on;
		},
		line: () => {},
		circle: () => {},
		rect: () => {},
		label: () => {},
		counter: () => {},
		drain: () => [],
	};
};
