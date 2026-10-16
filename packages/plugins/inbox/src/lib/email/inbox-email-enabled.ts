/**
 * Whether the Inbox email features (mailboxes, the inbound pipeline, provider accounts; plan 04 §5) are loaded.
 * Off unless `GAUZY_INBOX_EMAIL_ENABLED` is exactly `true`, and only ever on top of the Inbox itself
 * (`GAUZY_INBOX_ENABLED=true`): `apps/api/src/plugins.ts` lists `InboxEmailPlugin` only when both are on. Unset,
 * empty and `false` keep it off silently; any other value keeps it off and is reported once through `warn`, which
 * never repeats the value.
 *
 * Kept free of imports, like `isInboxEnabled`: `apps/api/src/plugins.ts` calls it while it builds its plugin list.
 */
export function isInboxEmailEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_INBOX_EMAIL_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_INBOX_EMAIL_ENABLED is neither "true" nor "false"; the Inbox email features stay off (the default).');
	return false;
}
