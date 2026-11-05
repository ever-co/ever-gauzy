import * as moment from 'moment';
import { ID, TimeLogSourceEnum } from '@gauzy/contracts';

/**
 * The Ever Teams clients, web and mobile. "Require a daily plan to track" is their team rule, so only their starts
 * are held to it: the desktop timer and the agent have no way to plan.
 */
export const PLAN_RULE_SOURCES: ReadonlyArray<string> = [TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE];

type PlanTasks = { tasks?: { id?: ID }[] | null };

export const DAILY_PLAN_REQUIRED = 'DAILY_PLAN_REQUIRED';
export const TASK_NOT_PLANNED = 'TASK_NOT_PLANNED';

/**
 * The dates a daily plan may carry and still count as today's. Ever Teams stores a plan at UTC midnight of its day,
 * and the API does not know the member's own day: far from UTC, a member can be on the day before or after the
 * server's. The window takes the day on each side, so a member who planned their own today is never refused.
 *
 * @param now The server's current time.
 */
export function planDatesAroundToday(now: moment.Moment): { from: Date; to: Date } {
	const today = now.clone().utc().startOf('day');
	const from = today.clone().subtract(1, 'day').toDate();
	const to = today.clone().add(1, 'day').endOf('day').toDate();
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
