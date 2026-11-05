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
 * who planned their own today is never refused. A plan day has two readings once the API process does not run in
 * UTC: Ever Teams sends it as a date, parsed as UTC midnight, while a client sending a local date-time lands on the
 * process's midnight, the way PostgreSQL and MySQL store dates (see storedDayStart). Each bound takes the reading
 * that widens the window, so neither kind of plan is cut off.
 *
 * @param now The server's current time.
 */
export function planDatesAroundToday(now: moment.Moment): { from: Date; to: Date } {
	const today = now.clone().utc().startOf('day');
	const firstDay = today.clone().subtract(1, 'day');
	const dayAfterWindow = today.clone().add(2, 'days');
	const from = new Date(earliestStartOf(firstDay));
	const windowEnd = latestStartOf(dayAfterWindow);
	const to = new Date(windowEnd - 1);
	return { from, to };
}

function dayStartReadings(utcDay: moment.Moment): number[] {
	const utcStart = utcDay.valueOf();
	const storedStart = storedDayStart(utcDay.format('YYYY-MM-DD')).getTime();
	return [utcStart, storedStart];
}

function earliestStartOf(utcDay: moment.Moment): number {
	return Math.min(...dayStartReadings(utcDay));
}

function latestStartOf(utcDay: moment.Moment): number {
	return Math.max(...dayStartReadings(utcDay));
}

export function planHasTasks(plan: PlanTasks): boolean {
	const tasks = plan.tasks ?? [];
	return tasks.length > 0;
}

export function planHoldsTask(plan: PlanTasks, taskId: ID): boolean {
	const tasks = plan.tasks ?? [];
	return tasks.some((task) => task.id === taskId);
}
