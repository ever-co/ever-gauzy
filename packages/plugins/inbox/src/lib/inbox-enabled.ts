/**
 * Whether the Inbox plugin is loaded. Off unless `GAUZY_INBOX_ENABLED` is exactly `true`; unset, empty and
 * `false` keep it off silently, any other value (`TRUE`, `1`, `yes`, ...) keeps it off and is reported once
 * through `warn`, which never repeats the value.
 *
 * Kept free of imports: `apps/api/src/plugins.ts` calls it while it builds its plugin list. Same contract as
 * `isEverWorksEnabled` of `@gauzy/plugin-integration-ever-works`.
 */
export function isInboxEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_INBOX_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_INBOX_ENABLED is neither "true" nor "false"; the Inbox stays off (the default).');
	return false;
}
