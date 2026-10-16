/**
 * Whether the Ever Works integration plugin is loaded. Off unless `EVER_WORKS_ENABLED` is exactly
 * `true`; unset, empty and `false` keep it off silently, any other value (`TRUE`, `1`, `yes`, ...)
 * keeps it off and is reported once through `warn`, which never repeats the value (it could be
 * anything an operator typed).
 *
 * Kept free of imports: `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts` call it while they
 * build their plugin lists, and the module calls it again at run time (a settings file read after the
 * list was built). Same contract as `isEverConnectEnabled` of `@gauzy/plugin-ever-connect`.
 */
export function isEverWorksEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['EVER_WORKS_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('EVER_WORKS_ENABLED is neither "true" nor "false"; the Ever Works integration stays off (the default).');
	return false;
}
