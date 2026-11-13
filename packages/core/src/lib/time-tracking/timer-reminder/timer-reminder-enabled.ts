/**
 * Whether the platform reminds employees of a timer left running (an Inbox entry, and the email and push the
 * employee's notification preferences ask for). Off unless `GAUZY_TIMER_REMINDERS_ENABLED` is exactly `true`; unset,
 * empty and `false` keep it off silently, any other value keeps it off and is reported once through `warn`, which never
 * repeats the value.
 *
 * Same contract as the follower fan-out (`isNotificationFanOutEnabled`) and the plugin switches: new behaviour is off
 * by default on an installation that did not ask for it.
 */
export function isTimerRemindersEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_TIMER_REMINDERS_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_TIMER_REMINDERS_ENABLED is neither "true" nor "false"; timer reminders stay off (the default).');
	return false;
}
