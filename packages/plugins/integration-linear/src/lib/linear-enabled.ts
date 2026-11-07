/**
 * Whether the Linear integration plugin is loaded. Off unless `LINEAR_ENABLED` is exactly `true`; unset,
 * empty and `false` keep it off silently, any other value (`TRUE`, `1`, `yes`, ...) keeps it off and is
 * reported once through `warn`, which never repeats the value (it could be anything an operator typed).
 *
 * Kept free of imports: `apps/api/src/plugins.ts` calls it while it builds the plugin list, and the
 * lifecycle calls it again at run time. Same contract as `isEverWorksEnabled` of
 * `@gauzy/plugin-integration-ever-works`.
 */
export function isLinearEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['LINEAR_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('LINEAR_ENABLED is neither "true" nor "false"; the Linear integration stays off (the default).');
	return false;
}
