import { ID, TimeGoalComparisonEnum, TimeGoalPeriodEnum, TimeGoalStateEnum, WeekDaysEnum } from '@gauzy/contracts';
import { moment } from '../../core/moment-extend';

/** The local calendar date format the progress read takes and answers. */
export const LOCAL_DATE_FORMAT = 'YYYY-MM-DD';

const SECONDS_PER_HOUR = 3600;

/** The most hours each period holds: a day, a week, a month of 31 days. */
const MAX_HOURS_OF_PERIOD: Record<TimeGoalPeriodEnum, number> = {
	[TimeGoalPeriodEnum.DAY]: 24,
	[TimeGoalPeriodEnum.WEEK]: 7 * 24,
	[TimeGoalPeriodEnum.MONTH]: 31 * 24
};

/** The day of the week (0 for Sunday) each week start names. */
const WEEK_DAY_INDEX: Record<WeekDaysEnum, number> = {
	[WeekDaysEnum.SUNDAY]: 0,
	[WeekDaysEnum.MONDAY]: 1,
	[WeekDaysEnum.TUESDAY]: 2,
	[WeekDaysEnum.WEDNESDAY]: 3,
	[WeekDaysEnum.THURSDAY]: 4,
	[WeekDaysEnum.FRIDAY]: 5,
	[WeekDaysEnum.SATURDAY]: 6
};

/**
 * The instants a period covers, `start` included and `end` excluded, with its first and last local calendar days.
 */
export interface TimeGoalPeriodRange {
	start: Date;
	end: Date;
	startDate: string;
	endDate: string;
}

/**
 * What a time log brings to the count: when it ran, whether it is billable, and the project and clients it is on.
 */
export interface TimeGoalCountedLog {
	startedAt: Date;
	stoppedAt: Date | null;
	isBillable: boolean | null;
	projectId: ID | null;
	organizationContactId: ID | null;
	/** The client of the log's project. */
	projectOrganizationContactId: ID | null;
}

/**
 * What a goal counts. A list left empty counts every project, or every client.
 */
export interface TimeGoalCountFilter {
	projectIds?: ID[];
	organizationContactIds?: ID[];
	billableOnly?: boolean;
	/** The goal counts its listed projects only, even when none is left. */
	listedProjectsOnly?: boolean;
	/** The goal counts its listed clients only, even when none is left. */
	listedClientsOnly?: boolean;
}

/**
 * Where a tracked time stands against a goal: "at least" is achieved once the target is reached, "at most" is
 * exceeded once the target is passed.
 */
export function stateOf(
	comparison: TimeGoalComparisonEnum,
	trackedSeconds: number,
	targetSeconds: number
): TimeGoalStateEnum {
	if (comparison === TimeGoalComparisonEnum.AT_MOST) {
		if (trackedSeconds > targetSeconds) {
			return TimeGoalStateEnum.EXCEEDED;
		}
		return TimeGoalStateEnum.ON_TRACK;
	}
	if (trackedSeconds >= targetSeconds) {
		return TimeGoalStateEnum.ACHIEVED;
	}
	return TimeGoalStateEnum.IN_PROGRESS;
}

/**
 * The target of a goal in whole seconds.
 */
export function targetSecondsOf(targetHours: number): number {
	return Math.round(Number(targetHours) * SECONDS_PER_HOUR);
}

/**
 * The most hours a period holds.
 */
export function maxHoursOfPeriod(period: TimeGoalPeriodEnum): number {
	return MAX_HOURS_OF_PERIOD[period];
}

/**
 * Whether a target fits in its period: no goal asks for more than 24 hours a day.
 */
export function isTargetWithinPeriod(period: TimeGoalPeriodEnum, targetHours: number): boolean {
	return Number(targetHours) <= maxHoursOfPeriod(period);
}

/**
 * Today's local calendar date in a time zone.
 */
export function todayIn(timeZone: string, now: Date): string {
	return moment(now).tz(timeZone).format(LOCAL_DATE_FORMAT);
}

/**
 * The period of a goal that holds a local calendar date, in a time zone: the day itself, the week that holds it
 * (starting on the organization's week start, Monday when it names none), or its calendar month.
 *
 * @param period - The goal's period.
 * @param date - A local calendar date (YYYY-MM-DD).
 * @param timeZone - The IANA time zone the period is counted in.
 * @param weekStart - The organization's week start.
 */
export function periodRangeOf(
	period: TimeGoalPeriodEnum,
	date: string,
	timeZone: string,
	weekStart: WeekDaysEnum | null | undefined
): TimeGoalPeriodRange {
	const day = moment.tz(date, LOCAL_DATE_FORMAT, true, timeZone).startOf('day');
	let first = day.clone();
	let next = day.clone().add(1, 'day');

	if (period === TimeGoalPeriodEnum.WEEK) {
		const weekStartIndex = WEEK_DAY_INDEX[weekStart ?? WeekDaysEnum.MONDAY];
		const daysSinceWeekStart = (day.day() - weekStartIndex + 7) % 7;
		first = day.clone().subtract(daysSinceWeekStart, 'days');
		next = first.clone().add(7, 'days');
	}
	if (period === TimeGoalPeriodEnum.MONTH) {
		first = day.clone().startOf('month');
		next = first.clone().add(1, 'month');
	}

	return {
		start: first.toDate(),
		end: next.toDate(),
		startDate: first.format(LOCAL_DATE_FORMAT),
		endDate: next.clone().subtract(1, 'day').format(LOCAL_DATE_FORMAT)
	};
}

/**
 * The seconds a goal counts in a period: the time of the logs that start in it and match each of the goal's
 * filters, as the statistics count tracked time. A running log counts up to `now`; a log that ends before it
 * starts counts nothing.
 */
export function trackedSecondsOf(
	logs: TimeGoalCountedLog[],
	filter: TimeGoalCountFilter,
	range: Pick<TimeGoalPeriodRange, 'start' | 'end'>,
	now: Date
): number {
	let totalMilliseconds = 0;
	for (const log of logs) {
		const isCounted = isInPeriod(log, range) && matchesFilter(log, filter);
		if (!isCounted) {
			continue;
		}
		const stoppedAt = log.stoppedAt ?? now;
		const duration = new Date(stoppedAt).getTime() - new Date(log.startedAt).getTime();
		if (duration > 0) {
			totalMilliseconds += duration;
		}
	}
	return Math.round(totalMilliseconds / 1000);
}

/** Whether a log starts in the period. */
function isInPeriod(log: TimeGoalCountedLog, range: Pick<TimeGoalPeriodRange, 'start' | 'end'>): boolean {
	const startedAt = new Date(log.startedAt).getTime();
	const startsAfterPeriodStart = startedAt >= range.start.getTime();
	const startsBeforePeriodEnd = startedAt < range.end.getTime();
	return startsAfterPeriodStart && startsBeforePeriodEnd;
}

/** Whether a log matches every filter of a goal. */
function matchesFilter(log: TimeGoalCountedLog, filter: TimeGoalCountFilter): boolean {
	const projectIds = filter.projectIds ?? [];
	const clientIds = filter.organizationContactIds ?? [];

	const isBillableMismatch = filter.billableOnly === true && log.isBillable !== true;
	if (isBillableMismatch) {
		return false;
	}
	const isRestrictedToProjects = filter.listedProjectsOnly === true || projectIds.length > 0;
	const isProjectMismatch = isRestrictedToProjects && !projectIds.includes(log.projectId);
	if (isProjectMismatch) {
		return false;
	}
	const isRestrictedToClients = filter.listedClientsOnly === true || clientIds.length > 0;
	if (isRestrictedToClients) {
		const isOnClient = clientIds.includes(log.organizationContactId);
		const isOnClientProject = clientIds.includes(log.projectOrganizationContactId);
		return isOnClient || isOnClientProject;
	}
	return true;
}
