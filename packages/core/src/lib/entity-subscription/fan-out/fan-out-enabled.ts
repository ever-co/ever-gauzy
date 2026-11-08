/**
 * Whether changes to a record reach its followers as notifications (a comment on a task they follow, a status
 * change of it). Off unless `GAUZY_NOTIFICATION_FANOUT_ENABLED` is exactly `true`; unset, empty and `false` keep
 * it off silently, any other value keeps it off and is reported once through `warn`, which never repeats the value.
 *
 * Same contract as the plugin switches (`isInboxEnabled`, `isRealtimeEnabled`): new behaviour is off by default
 * on an installation that did not ask for it.
 */
export function isNotificationFanOutEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_NOTIFICATION_FANOUT_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_NOTIFICATION_FANOUT_ENABLED is neither "true" nor "false"; follower notifications stay off (the default).');
	return false;
}
