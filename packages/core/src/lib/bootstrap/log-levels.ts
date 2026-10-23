/**
 * The Nest log levels the API prints, from `LOG_LEVEL`.
 *
 * The levels used to be hard-coded to everything (`log`, `error`, `warn`, `debug`, `verbose`), and the Sentry
 * logger the production API runs with is a `ConsoleLogger` whose default is everything as well — so the
 * deployments' `LOG_LEVEL=info` was never read and debug/verbose lines were written in production. Every line is
 * a synchronous `write(2)` to the container's stdout pipe on Linux, i.e. it blocks the event loop for as long as
 * the log collector takes to drain it.
 *
 * `LOG_LEVEL` unset keeps the previous behaviour (every level), so nothing changes for a deployment that does not
 * ask for it. A level enables itself and everything more severe; `fatal` is always printed.
 */
export type NestLogLevel = 'fatal' | 'error' | 'warn' | 'log' | 'debug' | 'verbose';

const ORDER: NestLogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

/** Levels printed when LOG_LEVEL is unset: what the API always printed. */
export const DEFAULT_LOG_LEVELS: NestLogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'];

const ALIASES: Record<string, NestLogLevel> = {
	fatal: 'fatal',
	error: 'error',
	warn: 'warn',
	warning: 'warn',
	info: 'log',
	log: 'log',
	debug: 'debug',
	verbose: 'verbose',
	trace: 'verbose',
	all: 'verbose'
};

export function resolveLogLevels(value: string | undefined): NestLogLevel[] {
	const key = String(value ?? '')
		.trim()
		.toLowerCase();
	if (!key) {
		return [...DEFAULT_LOG_LEVELS];
	}
	const threshold = ALIASES[key];
	if (!threshold) {
		console.warn(
			`Unknown LOG_LEVEL "${value}"; printing every level. Use one of: ${Object.keys(ALIASES).join(', ')}.`
		);
		return [...DEFAULT_LOG_LEVELS];
	}
	return ORDER.slice(0, ORDER.indexOf(threshold) + 1);
}

/** Whether `level` is printed under `LOG_LEVEL`. */
export function isLogLevelEnabled(level: NestLogLevel, value: string | undefined = process.env.LOG_LEVEL): boolean {
	return resolveLogLevels(value).includes(level);
}
