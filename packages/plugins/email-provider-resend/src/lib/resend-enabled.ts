/**
 * Whether the Resend email provider plugin is loaded. Off unless `EMAIL_PROVIDER_RESEND_ENABLED` is exactly `true`;
 * unset, empty and `false` keep it off silently, any other value keeps it off and is reported once through `warn`,
 * which never repeats the value.
 *
 * Kept free of imports: `apps/api/src/plugins.ts` calls it while it builds its plugin list. The plugin only does
 * something where the Inbox email features are on too (`GAUZY_INBOX_EMAIL_ENABLED=true`): it registers with their
 * provider registry.
 */
export function isResendEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['EMAIL_PROVIDER_RESEND_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn(
		'EMAIL_PROVIDER_RESEND_ENABLED is neither "true" nor "false"; the Resend email provider stays off (the default).'
	);
	return false;
}
