import * as moment from 'moment';
import { ID, TimeLogSourceEnum } from '@gauzy/contracts';
import { storedDayStart } from '../../tasks/daily-plan/daily-plan-stored-day';

/**
 * The Ever Teams clients, web and mobile. "Require a daily plan to track" is their team rule, so only their starts
 * are held to it: the desktop timer and the agent have no way to plan.
 */
export const PLAN_RULE_SOURCES: ReadonlyArray<string> = [TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE];

type PlanTasks = { tasks?: { id?: ID }[] | null };

export const DAILY_PLAN_REQUIRED = 'DAILY_PLAN_REQUIRED';
export const TASK_NOT_PLANNED = 'TASK_NOT_PLANNED';

/**
 * The dates a daily plan may carry and still count as today's. The API does not know the member's own day: far from
 * UTC, a member can be on the day before or after the server's. The window takes the day on each side, so a member
 * who planned their own today is never refused. Its bounds are converted the way plan dates are stored (see
 * storedDayStart), or a plan stored at local midnight could fall just outside them.
 *
 * @param now The server's current time.
 */
export function planDatesAroundToday(now: moment.Moment): { from: Date; to: Date } {
	const today = now.clone().utc().startOf('day');
	const firstDay = today.clone().subtract(1, 'day').format('YYYY-MM-DD');
	const dayAfterWindow = today.clone().add(2, 'days').format('YYYY-MM-DD');
	const from = storedDayStart(firstDay);
	const windowEnd = storedDayStart(dayAfterWindow).getTime();
	const to = new Date(windowEnd - 1);
	return { from, to };
}

export function planHasTasks(plan: PlanTasks): boolean {
	const tasks = plan.tasks ?? [];
	return tasks.length > 0;
}

export function planHoldsTask(plan: PlanTasks, taskId: ID): boolean {
	const tasks = plan.tasks ?? [];
	return tasks.some((task) => task.id === taskId);
}
