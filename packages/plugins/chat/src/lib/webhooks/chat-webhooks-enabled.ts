/**
 * Whether chat incoming webhooks are on. Off unless `GAUZY_CHAT_WEBHOOKS_ENABLED` is exactly `true`; unset, empty and
 * `false` keep them off silently, and any other value (`TRUE`, `1`, `yes`, ...) keeps them off and is reported once
 * through `warn`, which never repeats the value. The same contract as `isChatEnabled`, of which it is a part: webhooks
 * are only ever served by the chat plugin, so they also need `GAUZY_CHAT_ENABLED=true`.
 *
 * Read per request (not at import): off, every webhook route answers 404, nothing is posted and nothing is called back.
 */
export function isChatWebhooksEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_CHAT_WEBHOOKS_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_CHAT_WEBHOOKS_ENABLED is neither "true" nor "false"; chat webhooks stay off (the default).');
	return false;
}
