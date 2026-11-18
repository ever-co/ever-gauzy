import type { Moment } from 'moment';
import {
	ID,
	IEmbedClientReport,
	IEmbedClientReportProject,
	IOrganization,
	SavedReportPeriodRuleEnum
} from '@gauzy/contracts';
import { moment } from '../core/moment-extend';
import { resolveSavedReportPeriod, savedReportTimeZoneOf, weekStartDayOf } from '../saved-report/saved-report-period';
import { isTrackerSource } from '../time-tracking/time-log/tracker-source';
import { exclusiveWindowEnd, secondsWithinWindow } from '../time-tracking/timer/timer.helper';

/** Days of the organization's calendar, and the instants that bound them: `from` included, `until` excluded. */
export interface IEmbedClientReportSpan {
	/** The first day, `YYYY-MM-DD`, in the report's zone. */
	startDate: string;
	/** The last day, `YYYY-MM-DD`, in the report's zone, included. */
	endDate: string;
	from: Moment;
	until: Moment;
}

/** The zone a client report counts in, and its two spans: today and this week. */
export interface IEmbedClientReportPeriods {
	timeZone: string;
	today: IEmbedClientReportSpan;
	week: IEmbedClientReportSpan;
}

/** A time entry as the report reads it. */
export interface IEmbedClientReportEntry {
	projectId: ID;
	startedAt: Date;
	stoppedAt: Date | null;
	isRunning: boolean | null;
	source: string | null;
}

/** What a client report is made of. */
export interface IEmbedClientReportFacts {
	client: IEmbedClientReport['client'];
	periods: IEmbedClientReportPeriods;
	/** Every project of the client, with or without time. */
	projects: ReadonlyArray<Pick<IEmbedClientReportProject, 'id' | 'name'>>;
	/** The entries of those projects that reach into the week. */
	entries: ReadonlyArray<IEmbedClientReportEntry>;
	now: Date;
}

/** A day's or a rule's period, read in `timeZone`, with its end made exclusive. */
function spanOf(
	rule: SavedReportPeriodRuleEnum,
	timeZone: string,
	weekStartsOn: number,
	now: Date
): IEmbedClientReportSpan {
	const period = resolveSavedReportPeriod({ periodRule: rule, timeZone }, weekStartsOn, now);
	return {
		startDate: period.startDate,
		endDate: period.endDate,
		from: moment.utc(period.start),
		until: exclusiveWindowEnd(moment.utc(period.end))
	};
}

/**
 * Today and this week in the organization's calendar, as the saved reports count them: its time zone when it has a
 * known one (UTC otherwise), and its first day of the week (Monday when it has none).
 *
 * @param organization The organization's zone and first day of the week.
 * @param now When the report is asked.
 */
export function clientReportPeriodsOf(
	organization: Pick<IOrganization, 'timeZone' | 'startWeekOn'>,
	now: Date
): IEmbedClientReportPeriods {
	const timeZone = savedReportTimeZoneOf(organization.timeZone);
	const weekStartsOn = weekStartDayOf(organization.startWeekOn);
	return {
		timeZone,
		today: spanOf(SavedReportPeriodRuleEnum.TODAY, timeZone, weekStartsOn, now),
		week: spanOf(SavedReportPeriodRuleEnum.THIS_WEEK, timeZone, weekStartsOn, now)
	};
}

/**
 * Where an entry stops counting. A running timer run counts up to now: its stored end holds its start, or its last
 * heartbeat. A tracker (the desktop) stores the time it uploads as running by design, several rows at once, and moves
 * their end as it uploads: those count up to their stored end, as the time-log reports count them.
 *
 * @param entry The entry.
 * @param now When the report is asked.
 */
export function countedEndOf(entry: IEmbedClientReportEntry, now: Date): Date | null {
	const isTimerRun = entry.isRunning === true && !isTrackerSource(entry.source);
	if (isTimerRun) {
		return now;
	}
	return entry.stoppedAt;
}

/** The seconds of an entry within a span. */
function secondsWithin(entry: IEmbedClientReportEntry, span: IEmbedClientReportSpan, now: Date): number {
	return secondsWithinWindow(entry.startedAt, countedEndOf(entry, now), span.from, span.until);
}

/** Most seconds first; equal ones by name, then by id, so the order never changes between two reads. */
function byMostSeconds(a: IEmbedClientReportProject, b: IEmbedClientReportProject): number {
	if (a.seconds !== b.seconds) {
		return b.seconds - a.seconds;
	}
	const byName = a.name.localeCompare(b.name);
	if (byName !== 0) {
		return byName;
	}
	return a.id.localeCompare(b.id);
}

/**
 * The client report: the seconds of the client's projects today and this week, each entry clipped to each span, and
 * this week's seconds by project, only the projects with time. An entry of any other project is left out.
 *
 * @param facts The client, the spans, the client's projects and their entries, and the time of the request.
 */
export function clientReportOf(facts: IEmbedClientReportFacts): IEmbedClientReport {
	const { periods, now } = facts;
	const weekSecondsByProject = new Map<ID, number>();
	for (const project of facts.projects) {
		weekSecondsByProject.set(project.id, 0);
	}

	let todaySeconds = 0;
	let weekSeconds = 0;
	for (const entry of facts.entries) {
		const projectSeconds = weekSecondsByProject.get(entry.projectId);
		if (projectSeconds === undefined) {
			continue;
		}
		const entryWeekSeconds = secondsWithin(entry, periods.week, now);
		weekSecondsByProject.set(entry.projectId, projectSeconds + entryWeekSeconds);
		weekSeconds += entryWeekSeconds;
		todaySeconds += secondsWithin(entry, periods.today, now);
	}

	const projects = facts.projects
		.map((project) => ({ id: project.id, name: project.name, seconds: weekSecondsByProject.get(project.id) }))
		.filter((project) => project.seconds > 0)
		.sort(byMostSeconds);

	return {
		client: { id: facts.client.id, name: facts.client.name },
		timeZone: periods.timeZone,
		today: { date: periods.today.startDate, seconds: todaySeconds },
		week: { start: periods.week.startDate, end: periods.week.endDate, seconds: weekSeconds },
		projects
	};
}
