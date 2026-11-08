import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

/**
 * Whether the task views extensions are served (saved-view manual order and version checks, bulk update,
 * built-in views, task reference resolution). Off unless `GAUZY_TASK_VIEWS_ENABLED` is exactly `true`; unset,
 * empty and `false` keep it off silently, any other value keeps it off and is reported once through `warn`.
 * The existing task and view routes are never affected. Same contract as `isChatEnabled` of `@gauzy/plugin-chat`.
 */
export function isTaskViewsEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['GAUZY_TASK_VIEWS_ENABLED'];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw === 'true') {
		return true;
	}
	warn('GAUZY_TASK_VIEWS_ENABLED is neither "true" nor "false"; the task views extensions stay off (the default).');
	return false;
}

let warnedOnce = false;

/**
 * Guards the routes the task views extensions add: where the switch is off they answer 404, exactly as a build
 * without them would, so a client probes one route to learn whether the extensions are there.
 */
@Injectable()
export class TaskViewsEnabledGuard implements CanActivate {
	canActivate(): boolean {
		const enabled = isTaskViewsEnabled(process.env, (message) => {
			if (!warnedOnce) {
				warnedOnce = true;
				console.warn(message);
			}
		});
		if (!enabled) {
			throw new NotFoundException('TASK_VIEWS_DISABLED: the task views extensions are not enabled on this server.');
		}
		return true;
	}
}
