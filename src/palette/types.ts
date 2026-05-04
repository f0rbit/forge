import type { Result } from "@f0rbit/corpus";
import { z } from "zod";
import type { Ctx } from "../schedule.ts";

export type CommandError =
	| { kind: "unknown_command"; name: string }
	| { kind: "parse"; message: string }
	| { kind: "validation"; issues: readonly string[] }
	| { kind: "runtime"; message: string };

export type CommandRunner<A> = (args: A, ctx: Ctx) => Promise<Result<string, CommandError>> | Result<string, CommandError>;

export type Command<A = unknown> = {
	name: string;
	desc?: string;
	args?: z.ZodType<A>;
	run: CommandRunner<A>;
};

export type CommandRegistration<A = unknown> = Command<A>;

export type SearchHit = { command: Command<unknown>; score: number };
