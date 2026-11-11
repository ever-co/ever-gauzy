/**
 * Whether chat link previews are on. Off unless `GAUZY_CHAT_LINK_PREVIEWS_ENABLED` is exactly `true`; unset, empty
 * and `false` keep them off silently, and any other value (`TRUE`, `1`, `yes`, ...) keeps them off and is reported
 * once through `warn`, which never repeats the value. The same contract as `isChatEnabled`, of which it is a part:
 * previews are only ever served by the chat plugin, so they also need `GAUZY_CHAT_ENABLED=true`.
 *
 * Off, the preview route answers 404, no preview queue is registered and the server fetches nothing.
 */
export function isChatLinkPreviewsEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_CHAT_LINK_PREVIEWS_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_CHAT_LINK_PREVIEWS_ENABLED is neither "true" nor "false"; chat link previews stay off (the default).');
	return false;
}
