/**
 * Whether the Inbox emails the employees' notifications in this installation: its plugin and its notification email
 * lane are both on (`GAUZY_INBOX_ENABLED` and `GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED`), each read the way the plugin
 * reads it, on only when exactly `true` (`isInboxEnabled` and `isInboxNotificationEmailEnabled` of
 * `@gauzy/plugin-inbox`, which the core cannot import).
 *
 * A sender that emails someone about what it also notifies them of in-app skips its own email then, so that nobody gets
 * the same news twice.
 *
 * @param env - The environment to read, the process's by default.
 */
export function inboxEmailsNotifications(env: Record<string, string | undefined> = process.env): boolean {
	return env['GAUZY_INBOX_ENABLED'] === 'true' && env['GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED'] === 'true';
}
