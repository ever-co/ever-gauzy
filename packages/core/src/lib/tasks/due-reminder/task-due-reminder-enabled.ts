/**
 * Whether the platform reminds assignees of a task's due date (an Inbox entry, and the email and push the employee's
 * notification preferences ask for). Off unless `GAUZY_TASK_DUE_REMINDERS_ENABLED` is exactly `true`; unset, empty and
 * `false` keep it off silently, any other value keeps it off and is reported once through `warn`, which never repeats
 * the value.
 *
 * Same contract as the timer reminders (`isTimerRemindersEnabled`) and the follower fan-out: new behaviour is off by
 * default on an installation that did not ask for it.
 */
export function isTaskDueRemindersEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_TASK_DUE_REMINDERS_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_TASK_DUE_REMINDERS_ENABLED is neither "true" nor "false"; task due reminders stay off (the default).');
	return false;
}
