import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

/**
 * Whether the task trash is listed (`GET /tasks/trash`) and a task can be deleted for good from it
 * (`DELETE /tasks/:id/trashed`). Off unless `GAUZY_TASK_TRASH_ENABLED` is exactly `true`; unset, empty and `false`
 * keep it off silently, any other value keeps it off and is reported once through `warn`. Moving a task to the trash
 * and restoring it (`DELETE /tasks/:id/soft`, `PUT /tasks/:id/recover`) existed before and are not behind it. Same
 * contract as {@link isTaskViewsEnabled}.
 */
export function isTaskTrashEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_TASK_TRASH_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_TASK_TRASH_ENABLED is neither "true" nor "false"; the task trash stays off (the default).');
	return false;
}

let warnedOnce = false;

/**
 * Guards the trash routes: where the switch is off they answer 404, exactly as a build without them would, so a client
 * probes the list to learn whether to offer a trash (and to move deleted tasks there).
 */
@Injectable()
export class TaskTrashEnabledGuard implements CanActivate {
	canActivate(): boolean {
		const enabled = isTaskTrashEnabled(process.env, (message) => {
			if (!warnedOnce) {
				warnedOnce = true;
				console.warn(message);
			}
		});
		if (!enabled) {
			throw new NotFoundException('TASK_TRASH_DISABLED: the task trash is not enabled on this server.');
		}
		return true;
	}
}
