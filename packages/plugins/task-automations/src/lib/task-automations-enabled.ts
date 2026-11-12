/**
 * Whether the task automations plugin is loaded. Off unless `GAUZY_TASK_AUTOMATIONS_ENABLED` is exactly `true`;
 * unset, empty and `false` keep it off silently, any other value (`TRUE`, `1`, `yes`, ...) keeps it off and is
 * reported once through `warn`, which never repeats the value.
 *
 * Kept free of imports: `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts` call it while they build their
 * plugin lists. Same contract as `isInboxEnabled` of `@gauzy/plugin-inbox`.
 */
export function isTaskAutomationsEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_TASK_AUTOMATIONS_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_TASK_AUTOMATIONS_ENABLED is neither "true" nor "false"; task automations stay off (the default).');
	return false;
}
