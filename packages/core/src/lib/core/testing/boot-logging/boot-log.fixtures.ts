import { inspect } from 'util';

/**
 * Every environment variable the Redis bootstrap code reads to build its connection URL.
 */
export const REDIS_ENV_KEYS = [
	'REDIS_ENABLED',
	'REDIS_URL',
	'REDIS_HOST',
	'REDIS_PORT',
	'REDIS_USER',
	'REDIS_PASSWORD',
	'REDIS_TLS'
] as const;

/**
 * Registers `beforeEach`/`afterEach` hooks that give each test a clean copy of the given
 * environment variables and capture everything written through `console.*` while it runs.
 *
 * Each captured line is the console call's arguments joined with a space, with non-string
 * arguments rendered through `util.inspect` - the same rendering Node uses when it prints them -
 * so an assertion on `lines` sees what would really reach stdout, including an error's own
 * properties such as `ERR_INVALID_URL.input`.
 *
 * The variables are unset before each test and restored after it, so a developer's own settings
 * can neither leak into nor be clobbered by these tests.
 *
 * @param envKeys - The environment variables the code under test reads.
 * @returns A live view of the lines captured during the current test.
 */
export function captureBootLogs(envKeys: readonly string[]): { readonly lines: string[] } {
	const captured = { lines: [] as string[] };
	let savedEnv: Record<string, string | undefined>;
	let spies: jest.SpyInstance[];

	beforeEach(() => {
		savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
		envKeys.forEach((key) => delete process.env[key]);

		captured.lines = [];
		spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
			jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
				captured.lines.push(
					args.map((arg) => (typeof arg === 'string' ? arg : inspect(arg, { depth: 5 }))).join(' ')
				);
			})
		);
	});

	afterEach(() => {
		spies.forEach((spy) => spy.mockRestore());
		envKeys.forEach((key) => {
			if (savedEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = savedEnv[key];
			}
		});
	});

	return captured;
}
