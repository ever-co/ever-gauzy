/**
 * Whether the Ever Platform connection plugin is loaded. Off unless `EVER_CONNECT_ENABLED` is exactly
 * `true`; unset, empty and `false` keep it off silently, any other value (`TRUE`, `1`, `yes`, ...)
 * keeps it off and is reported once through `warn`, which never repeats the value (it could be
 * anything an operator typed).
 *
 * Kept free of imports: `apps/api/src/plugins.ts` calls it while it builds the plugin list, and the
 * module calls it again at run time (a settings file read after the list was built).
 */
export function isEverConnectEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['EVER_CONNECT_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('EVER_CONNECT_ENABLED is neither "true" nor "false"; the Ever Platform connection stays off (the default).');
	return false;
}
