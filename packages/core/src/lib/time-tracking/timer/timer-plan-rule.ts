import * as moment from 'moment';
import { ID, TimeLogSourceEnum } from '@gauzy/contracts';
import { dayIfTodaySomewhere } from '../../tasks/daily-plan/daily-plan-caller-day';
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

/**
 * The dates a plan for `planDay` may carry. Ever Teams sends a plan day as a date, parsed as UTC midnight, while a
 * client sending a local date-time lands on the process's midnight (see storedDayStart). The day starts at the
 * earlier of its two midnights and ends where the next day's earlier midnight starts: both readings of that day are
 * in, and neither reading of the day before or after is.
 *
 * @param planDay A plan day, as `YYYY-MM-DD`.
 */
export function planDatesOfDay(planDay: string): { from: Date; to: Date } {
	const day = moment.utc(planDay, 'YYYY-MM-DD');
	const nextDay = day.clone().add(1, 'day');
	const from = new Date(earliestStartOf(day));
	const nextDayStart = earliestStartOf(nextDay);
	const to = new Date(nextDayStart - 1);
	return { from, to };
}

/**
 * The dates the plans of a start may carry: exactly the member's day when the client names it and it is today
 * somewhere, otherwise the window around today, for a client that does not send its day.
 *
 * @param planDay The day the client sent with the start, if any.
 * @param now The server's current time.
 */
export function planDatesForStart(planDay: unknown, now: moment.Moment): { from: Date; to: Date } {
	const memberDay = dayIfTodaySomewhere(planDay, now);
	if (!memberDay) {
		return planDatesAroundToday(now);
	}
	return planDatesOfDay(memberDay);
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
