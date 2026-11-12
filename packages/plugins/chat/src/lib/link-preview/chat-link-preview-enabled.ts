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

/**
 * Whether the platform also serves the pictures of the previews (`GET /chat/link-preview/image?url=`), so a client can
 * show them without the reader's browser loading them from the linked site. Off unless
 * `GAUZY_CHAT_LINK_PREVIEW_IMAGES_ENABLED` is exactly `true`, and only with the previews themselves on: each picture is
 * one more outbound request, and its bytes go through the API. The same contract as `isChatLinkPreviewsEnabled`.
 */
export function isChatLinkPreviewImagesEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	if (!isChatLinkPreviewsEnabled(env, () => undefined)) return false;
	const raw = env['GAUZY_CHAT_LINK_PREVIEW_IMAGES_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_CHAT_LINK_PREVIEW_IMAGES_ENABLED is neither "true" nor "false"; chat link preview pictures stay off (the default).');
	return false;
}
