import moment from 'moment-timezone';
import { IEmployee, ITimeLog } from '@gauzy/contracts';
import { DurationFormatPipe, IReportExportTable } from '@gauzy/ui-core/shared';

/** What an exported Manual Time Edits file is named, before its date range. */
export const MANUAL_TIME_REPORT_EXPORT_NAME = 'manual-time-edits';

/** How many manual entries one request reads. "Load more" reads the next page of the same size. */
export const MANUAL_TIME_REPORT_PAGE_SIZE = 50;

/** One day of the report: its manual entries, in the order they started, and what they add up to. */
export interface IManualTimeReportDay {
	/** The day, `YYYY-MM-DD`, in the time zone the report was read in. */
	readonly date: string;
	readonly timeLogs: ITimeLog[];
	/** The summed duration of the day's entries, in seconds. */
	readonly duration: number;
}

/** The figures over the strip at the top of the report. */
export interface IManualTimeReportSummary {
	/** The summed duration of every entry, in seconds. */
	readonly duration: number;
	readonly entries: number;
	readonly added: number;
	readonly edited: number;
	/** How many different employees the entries belong to. */
	readonly employees: number;
}

/** The summary of a report with nothing in it. */
export const EMPTY_MANUAL_TIME_SUMMARY: IManualTimeReportSummary = {
	duration: 0,
	entries: 0,
	added: 0,
	edited: 0,
	employees: 0
};

/**
 * Whether an entry has been edited since it was added.
 *
 * `isEdited` is the column the API filters on, but older rows can carry only `editedAt`, so either counts.
 *
 * @param log - The time log.
 */
export function isEditedLog(log: ITimeLog): boolean {
	return !!log?.isEdited || !!log?.editedAt;
}

/**
 * When the manual action took place: the last edit of an edited entry, the creation of an added one.
 *
 * @param log - The time log.
 */
export function changedAtOf(log: ITimeLog): Date | string | null {
	return (isEditedLog(log) ? log.editedAt ?? log.updatedAt : log.createdAt) ?? null;
}

/**
 * The day an entry belongs to in a time zone, `YYYY-MM-DD`.
 *
 * @param value - The instant, as the API returns it (UTC).
 * @param timeZone - The IANA zone the report is read in; the browser's when not given.
 */
export function dayOf(value: Date | string, timeZone?: string): string {
	const instant = moment.utc(value);
	return (timeZone && moment.tz.zone(timeZone) ? instant.tz(timeZone) : instant.local()).format('YYYY-MM-DD');
}

/**
 * Groups the entries by the day they started on, in the report's time zone, oldest day first.
 *
 * @param logs - The entries, in the order the API returned them (by start).
 * @param timeZone - The IANA zone the report is read in.
 */
export function groupManualTimeLogsByDay(
	logs: ReadonlyArray<ITimeLog> | null | undefined,
	timeZone?: string
): IManualTimeReportDay[] {
	const days = new Map<string, ITimeLog[]>();
	for (const log of logs ?? []) {
		const date = dayOf(log.startedAt, timeZone);
		const timeLogs = days.get(date);
		if (timeLogs) {
			timeLogs.push(log);
		} else {
			days.set(date, [log]);
		}
	}
	return [...days.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, timeLogs]) => ({ date, timeLogs, duration: sumDuration(timeLogs) }));
}

/**
 * The figures over the report.
 *
 * @param logs - The entries the report shows.
 */
export function summarizeManualTimeLogs(logs: ReadonlyArray<ITimeLog> | null | undefined): IManualTimeReportSummary {
	const entries = logs ?? [];
	if (entries.length === 0) {
		return EMPTY_MANUAL_TIME_SUMMARY;
	}
	const edited = entries.filter(isEditedLog).length;
	const employees = new Set(entries.map((log) => log.employeeId ?? log.employee?.id).filter(Boolean));
	return {
		duration: sumDuration(entries),
		entries: entries.length,
		added: entries.length - edited,
		edited,
		employees: employees.size
	};
}

/**
 * The summed duration of some entries, in seconds.
 *
 * @param logs - The entries.
 */
function sumDuration(logs: ReadonlyArray<ITimeLog>): number {
	return logs.reduce((total, log) => total + (Number(log.duration) || 0), 0);
}

/**
 * The project page an entry links to, or `null` when it has no project.
 *
 * @param log - The time log.
 */
export function projectLinkOf(log: ITimeLog | null | undefined): string[] | null {
	const id = log?.project?.id ?? log?.projectId;
	return id ? ['/pages/organization/projects/view', id] : null;
}

/**
 * The task page an entry links to, or `null` when it has no task.
 *
 * @param log - The time log.
 */
export function taskLinkOf(log: ITimeLog | null | undefined): string[] | null {
	const id = log?.task?.id ?? log?.taskId;
	return id ? ['/pages/tasks/view', id] : null;
}

/**
 * The name the report shows for an employee.
 *
 * @param employee - The employee, as the report loads it.
 */
export function employeeNameOf(employee: IEmployee | null | undefined): string {
	const user = employee?.user;
	return employee?.fullName || user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '';
}

const durationFormat = new DurationFormatPipe();

/**
 * The report as a table for the export: one row per entry, with the instants in the report's time zone.
 *
 * It only reads the entries the page has already loaded, so the file holds exactly what the caller sees.
 *
 * @param logs - The entries the report shows.
 * @param translate - Translates a key of the UI's dictionary.
 * @param timeZone - The IANA zone the report is read in.
 */
export function buildManualTimeExportTable(
	logs: ReadonlyArray<ITimeLog>,
	translate: (key: string) => string,
	timeZone?: string
): IReportExportTable<ITimeLog> {
	const at = (value: Date | string | null | undefined, format: string): string => {
		if (!value) {
			return '';
		}
		const instant = moment.utc(value);
		return (timeZone && moment.tz.zone(timeZone) ? instant.tz(timeZone) : instant.local()).format(format);
	};
	return {
		columns: [
			{ key: 'date', header: translate('REPORT_PAGE.DATE'), value: (log) => dayOf(log.startedAt, timeZone) },
			{ key: 'employee', header: translate('REPORT_PAGE.EMPLOYEE'), value: (log) => employeeNameOf(log.employee) },
			{ key: 'project', header: translate('REPORT_PAGE.PROJECT'), value: (log) => log.project?.name ?? '' },
			{ key: 'task', header: translate('REPORT_PAGE.TO_DO'), value: (log) => log.task?.title ?? '' },
			{ key: 'reason', header: translate('REPORT_PAGE.REASON'), value: (log) => log.reason ?? '' },
			{ key: 'start', header: translate('REPORT_PAGE.MANUAL_TIME.START'), value: (log) => at(log.startedAt, 'HH:mm:ss') },
			{ key: 'end', header: translate('REPORT_PAGE.MANUAL_TIME.END'), value: (log) => at(log.stoppedAt, 'HH:mm:ss') },
			{
				key: 'duration',
				header: translate('REPORT_PAGE.DURATION'),
				value: (log) => durationFormat.transform(Number(log.duration) || 0)
			},
			// Exact decimal hours, so a spreadsheet can total the column
			{
				key: 'hours',
				header: translate('REPORT_PAGE.HOURS'),
				value: (log) => (Number(log.duration) || 0) / 3600
			},
			{
				key: 'changedAt',
				header: translate('REPORT_PAGE.CHANGED_AT'),
				value: (log) => at(changedAtOf(log), 'YYYY-MM-DD HH:mm:ss')
			},
			{
				key: 'action',
				header: translate('REPORT_PAGE.ACTION'),
				value: (log) => translate(isEditedLog(log) ? 'REPORT_PAGE.MANUAL_TIME.EDITED' : 'REPORT_PAGE.MANUAL_TIME.ADDED')
			},
			{
				key: 'billable',
				header: translate('REPORT_PAGE.MANUAL_TIME.BILLABLE'),
				value: (log) => translate(log.isBillable ? 'REPORT_PAGE.MANUAL_TIME.YES' : 'REPORT_PAGE.MANUAL_TIME.NO')
			}
		],
		rows: [...logs]
	};
}
