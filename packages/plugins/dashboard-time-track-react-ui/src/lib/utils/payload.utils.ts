import moment from 'moment-timezone';
import {
	IActivitiesStatistics,
	IDateRangePicker,
	IMembersStatistics,
	IOrganization,
	ITimeLogFilters,
	ITimeLogTodayFilters
} from '@gauzy/contracts';
import { isNotEmpty, toUtcOffset } from '@gauzy/ui-core/common';
import { getAdjustDateRangeFutureAllowed } from '@gauzy/ui-core/shared';

/** The Angular-side selection state the statistics payload is derived from. */
export interface TimeTrackingContext {
	organization: IOrganization;
	dateRange: IDateRangePicker;
	employeeIds: string[];
	projectIds: string[];
	teamIds: string[];
	/** IANA zone from `TimeZoneService.currentTimeZone`. */
	timeZone: string;
}

/** The request every statistics endpoint receives (`ITimeLogFilters & ITimeLogTodayFilters`). */
export type StatisticsPayload = ITimeLogFilters & ITimeLogTodayFilters;

/**
 * Builds the statistics request EXACTLY like Angular's `preparePayloads()`: today's bounds and
 * the (future-clamped) selected range are shifted by the selected zone's UTC offset
 * (`toUtcOffset`) and serialised as `YYYY-MM-DD HH:mm:ss`; `employeeIds` / `projectIds` /
 * `teamIds` are only attached when non-empty.
 *
 * @param context Selection state.
 * @param now Injectable "now" (defaults to `moment()`), for deterministic tests.
 */
export function buildStatisticsPayload(context: TimeTrackingContext, now: moment.Moment = moment()): StatisticsPayload {
	const { organization, dateRange, employeeIds, projectIds, teamIds, timeZone } = context;
	const { id: organizationId, tenantId } = organization;
	const { startDate, endDate } = getAdjustDateRangeFutureAllowed(dateRange);

	const request: StatisticsPayload = {
		tenantId,
		organizationId,
		todayStart: toUtcOffset(now.clone().startOf('day'), timeZone).format('YYYY-MM-DD HH:mm:ss'),
		todayEnd: toUtcOffset(now.clone().endOf('day'), timeZone).format('YYYY-MM-DD HH:mm:ss'),
		startDate: toUtcOffset(startDate, timeZone).format('YYYY-MM-DD HH:mm:ss'),
		endDate: toUtcOffset(endDate, timeZone).format('YYYY-MM-DD HH:mm:ss'),
		timeZone
	};

	if (isNotEmpty(employeeIds)) request.employeeIds = employeeIds;
	if (isNotEmpty(projectIds)) request.projectIds = projectIds;
	if (isNotEmpty(teamIds)) request.teamIds = teamIds;

	return request;
}

/**
 * Adds `durationPercentage` (share of the summed duration) to each activity — Angular
 * `getActivities()`.
 *
 * @param activities Raw activities from the API.
 */
export function withDurationPercentage(activities: IActivitiesStatistics[] | null | undefined): IActivitiesStatistics[] {
	const list = activities || [];
	const sum = list.reduce((memo, activity) => memo + parseInt(`${activity.duration}`, 10), 0);
	return list.map((activity) => ({
		...activity,
		durationPercentage: sum ? (activity.duration * 100) / sum : 0
	}));
}

/**
 * Normalises `weekHours` into exactly seven bars (day 0–6) whose `duration` is the share of the
 * member's weekly total — Angular `getMembers()`.
 *
 * @param members Raw members from the API.
 */
export function normalizeMemberWeekHours(members: IMembersStatistics[] | null | undefined): IMembersStatistics[] {
	return (members || []).map((member) => {
		const byDay = new Map<number, { day: number; duration: number }>();
		for (const entry of member.weekHours || []) byDay.set(Number(entry.day), entry);
		const sum = (member.weekHours || []).reduce((memo, day) => memo + parseInt(`${day.duration}`, 10), 0);
		const weekHours = Array.from({ length: 7 }, (_, day) => {
			const found = byDay.get(day);
			return found ? { ...found, duration: sum ? (found.duration * 100) / sum : 0 } : { day, duration: 0 };
		});
		return { ...member, weekHours };
	});
}
