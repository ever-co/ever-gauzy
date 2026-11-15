/**
 * Whether the platform reminds the hosts and invitees of a meeting before it starts and when it is about to (an Inbox
 * entry, and the email and push their notification preferences ask for). Off unless `GAUZY_MEETING_REMINDERS_ENABLED`
 * is exactly `true`; unset, empty and `false` keep it off silently, any other value keeps it off and is reported once
 * through `warn`, which never repeats the value.
 *
 * Same contract as the timer reminders (`isTimerRemindersEnabled`): new behaviour is off by default on an installation
 * that did not ask for it. The appointment booking pages of the platform write appointments too, and their hosts get
 * no reminder until the installation turns this on.
 */
export function isMeetingRemindersEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_MEETING_REMINDERS_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_MEETING_REMINDERS_ENABLED is neither "true" nor "false"; meeting reminders stay off (the default).');
	return false;
}
