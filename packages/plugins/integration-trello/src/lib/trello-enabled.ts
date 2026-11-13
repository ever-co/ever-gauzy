/**
 * Whether the Trello integration plugin is loaded. Off unless `TRELLO_ENABLED` is exactly `true`; unset,
 * empty and `false` keep it off silently, any other value (`TRUE`, `1`, `yes`, ...) keeps it off and is
 * reported once through `warn`, which never repeats the value (it could be anything an operator typed).
 *
 * Kept free of imports: `apps/api/src/plugins.ts` calls it while it builds the plugin list, and the
 * lifecycle calls it again at run time. Same contract as `isEverWorksEnabled` of
 * `@gauzy/plugin-integration-ever-works`.
 */
export function isTrelloEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['TRELLO_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('TRELLO_ENABLED is neither "true" nor "false"; the Trello integration stays off (the default).');
	return false;
}
