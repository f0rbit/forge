import { component, type Component, type Id, type World } from "./world.ts";
import type { System } from "./schedule.ts";

export type Follow = { target: Id; offset: { x: number; y: number } };

export const follow_c: Component<Follow> = component<Follow>("forge.follow");

export const follow_system = (pos_component: Component<{ x: number; y: number }>): System => {
	return (w: World) => {
		for (const [id, follow] of w.query([follow_c] as const).collect()) {
			const target_pos = w.get(follow.target, pos_component);
			if (!target_pos.ok) continue;
			w.set(id, pos_component, {
				x: target_pos.value.x + follow.offset.x,
				y: target_pos.value.y + follow.offset.y,
			});
		}
	};
};
