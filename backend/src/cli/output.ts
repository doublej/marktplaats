export interface Flags {
	json: boolean;
	quiet: boolean;
	noColor: boolean;
	noProgress: boolean;
}

export function parseFlags(argv: string[]): Flags {
	return {
		json: argv.includes("--json"),
		quiet: argv.includes("--quiet"),
		noColor: argv.includes("--no-color"),
		noProgress: argv.includes("--no-progress"),
	};
}

export function createOutput(flags: Flags) {
	const w = (text: string) => process.stdout.write(`${text}\n`);

	return {
		json(data: unknown) {
			w(JSON.stringify(data, null, 2));
		},
		write(text: string) {
			if (!flags.quiet) w(text);
		},
		heading(text: string, level = 2) {
			if (!flags.quiet) w(`\n${"#".repeat(level)} ${text}\n`);
		},
		kv(key: string, value: string) {
			if (!flags.quiet) w(`- **${key}:** ${value}`);
		},
		table(headers: string[], rows: string[][]) {
			const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
			w(`| ${headers.map(esc).join(" | ")} |`);
			w(`| ${headers.map(() => "---").join(" | ")} |`);
			for (const row of rows) {
				w(`| ${row.map(esc).join(" | ")} |`);
			}
			w("");
		},
		error(msg: string) {
			process.stderr.write(`error: ${msg}\n`);
		},
	};
}

export type Output = ReturnType<typeof createOutput>;

export interface Ctx {
	positionals: string[];
	flag: (name: string) => string | undefined;
	flags: Flags;
	out: Output;
}

export function fail(ctx: Ctx, message: string, code: string): never {
	if (ctx.flags.json) jsonError(message, code);
	ctx.out.error(message);
	return process.exit(1);
}

export function jsonError(message: string, code: string): never {
	process.stdout.write(`${JSON.stringify({ error: message, code })}\n`);
	return process.exit(1);
}

export function timeAgo(iso: string | null): string {
	if (!iso) return "never";
	const ms = Date.now() - new Date(iso).getTime();
	if (ms < 0) return "just now";
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s ago`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hrs = Math.floor(min / 60);
	if (hrs < 24) return `${hrs}h ago`;
	return `${Math.floor(hrs / 24)}d ago`;
}
