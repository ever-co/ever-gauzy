/**
 * Whether the chat plugin is loaded. Off unless `GAUZY_CHAT_ENABLED` is exactly `true`; unset, empty and
 * `false` keep it off silently, any other value (`TRUE`, `1`, `yes`, ...) keeps it off and is reported once
 * through `warn`, which never repeats the value.
 *
 * Kept free of imports: `apps/api/src/plugins.ts` calls it while it builds its plugin list. Same contract as
 * `isInboxEnabled` of `@gauzy/plugin-inbox`.
 */
export function isChatEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_CHAT_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_CHAT_ENABLED is neither "true" nor "false"; chat stays off (the default).');
	return false;
}
