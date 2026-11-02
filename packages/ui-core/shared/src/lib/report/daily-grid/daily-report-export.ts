import {
	IEmployee,
	IOrganizationContact,
	IOrganizationProject,
	IReportDayData,
	ITask,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { DurationFormatPipe } from '../../pipes/duration-format.pipe';
import { IReportExportColumn, IReportExportTable } from '../export/report-export.model';

/**
 * One time entry of the Time & Activity report, flattened out of whichever grouping the report is in: the
 * same row the daily grid shows under its group.
 */
export interface IDailyReportExportRow {
	/** The day, `YYYY-MM-DD` in the time zone the report was read in. */
	readonly date: string;
	readonly employee: string;
	readonly project: string;
	readonly client: string;
	readonly task: string;
	readonly notes: string;
	/** The tracked duration, in seconds. */
	readonly duration: number;
	/** The activity of the group the entry belongs to, as a percentage (the figure the grid shows). */
	readonly activity: number;
}

/*
 * The daily report as `GET /timesheet/time-log/report/daily` answers it for each grouping. The
 * `IReportDayGroupBy*` contracts lag behind that answer (the employee grouping nests `projectLogs`, and the
 * client grouping's `logs` is a list), so the shapes the grid reads are stated here.
 */
interface IDailyReportTask {
	task?: ITask | null;
	description?: string | null;
	duration?: number | null;
	client?: IOrganizationContact | null;
}

interface IDailyReportGroupLog {
	employee?: IEmployee | null;
	project?: IOrganizationProject | null;
	activity?: number | null;
	tasks?: IDailyReportTask[] | null;
}

interface IDailyReportByDate {
	date: string;
	logs?: { project?: IOrganizationProject | null; employeeLogs?: IDailyReportGroupLog[] | null }[] | null;
}

interface IDailyReportByEmployee {
	employee?: IEmployee | null;
	logs?: { date: string; projectLogs?: IDailyReportGroupLog[] | null }[] | null;
}

interface IDailyReportByProject {
	project?: IOrganizationProject | null;
	logs?: { date: string; employeeLogs?: IDailyReportGroupLog[] | null }[] | null;
}

interface IDailyReportByClient {
	client?: IOrganizationContact | null;
	logs?:
		| {
				project?: IOrganizationProject | null;
				logs?: { date: string; projectLogs?: IDailyReportGroupLog[] | null }[] | null;
		  }[]
		| null;
}

/** What one entry is read from: its day, the employee, project and client it belongs to, and its group. */
interface IEntryContext {
	date: string;
	employee?: IEmployee | null;
	project?: IOrganizationProject | null;
	/** The client of the whole group (client grouping); otherwise each task names its own. */
	client?: IOrganizationContact | null;
	group: IDailyReportGroupLog;
}

/**
 * Flattens the daily report, in any of its four groupings, into one row per time entry, in the order the
 * grid shows them.
 *
 * @param logs - The report as the grid holds it.
 * @param groupBy - The grouping the report was read in.
 * @returns One row per time entry.
 */
export function flattenDailyReport(
	logs: ReadonlyArray<IReportDayData> | null | undefined,
	groupBy: ReportGroupByFilter
): IDailyReportExportRow[] {
	const groups = (logs ?? []) as ReadonlyArray<unknown>;
	switch (groupBy) {
		case ReportGroupFilterEnum.employee:
			return (groups as IDailyReportByEmployee[]).flatMap((byEmployee) =>
				(byEmployee.logs ?? []).flatMap((day) =>
					(day.projectLogs ?? []).flatMap((group) =>
						toRows({ date: day.date, employee: byEmployee.employee, project: group.project, group })
					)
				)
			);
		case ReportGroupFilterEnum.project:
			return (groups as IDailyReportByProject[]).flatMap((byProject) =>
				(byProject.logs ?? []).flatMap((day) =>
					(day.employeeLogs ?? []).flatMap((group) =>
						toRows({ date: day.date, employee: group.employee, project: byProject.project, group })
					)
				)
			);
		case ReportGroupFilterEnum.client:
			return (groups as IDailyReportByClient[]).flatMap((byClient) =>
				(byClient.logs ?? []).flatMap((byProject) =>
					(byProject.logs ?? []).flatMap((day) =>
						(day.projectLogs ?? []).flatMap((group) =>
							toRows({
								date: day.date,
								employee: group.employee,
								project: byProject.project,
								client: byClient.client,
								group
							})
						)
					)
				)
			);
		case ReportGroupFilterEnum.date:
		default:
			return (groups as IDailyReportByDate[]).flatMap((byDate) =>
				(byDate.logs ?? []).flatMap((byProject) =>
					(byProject.employeeLogs ?? []).flatMap((group) =>
						toRows({ date: byDate.date, employee: group.employee, project: byProject.project, group })
					)
				)
			);
	}
}

/**
 * The rows of one group: one per task entry.
 *
 * @param context - The group and what its entries belong to.
 */
function toRows({ date, employee, project, client, group }: IEntryContext): IDailyReportExportRow[] {
	return (group.tasks ?? []).map((entry) => ({
		date: date ?? '',
		employee: employeeName(employee),
		project: project?.name ?? '',
		client: (client ?? entry.client)?.name ?? '',
		task: entry.task?.title ?? '',
		notes: entry.description ?? '',
		duration: Number(entry.duration) || 0,
		activity: Number(group.activity) || 0
	}));
}

/**
 * The name the grid shows for an employee.
 *
 * @param employee - The employee, as the report loads it.
 */
function employeeName(employee: IEmployee | null | undefined): string {
	const user = employee?.user;
	return employee?.fullName || user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '';
}

const durationFormat = new DurationFormatPipe();

/** What an exported Time & Activity file is named, before its date range. */
export const DAILY_REPORT_EXPORT_NAME = 'time-activity';

/** The columns of the export: one per grouping, then the entry's own. */
type DailyReportColumnKey = ReportGroupByFilter | 'task' | 'notes' | 'time' | 'hours' | 'activity';

/**
 * The export columns, keyed by what they show.
 *
 * @param translate - Translates a key of the UI's dictionary.
 */
function dailyReportColumns(
	translate: (key: string) => string
): Record<DailyReportColumnKey, IReportExportColumn<IDailyReportExportRow>> {
	return {
		date: { key: 'date', header: translate('REPORT_PAGE.DATE'), value: (row) => row.date },
		employee: { key: 'employee', header: translate('REPORT_PAGE.EMPLOYEE'), value: (row) => row.employee },
		project: { key: 'project', header: translate('REPORT_PAGE.PROJECT'), value: (row) => row.project },
		client: { key: 'client', header: translate('REPORT_PAGE.CLIENT'), value: (row) => row.client },
		task: { key: 'task', header: translate('REPORT_PAGE.TO_DO'), value: (row) => row.task },
		notes: { key: 'notes', header: translate('REPORT_PAGE.NOTES'), value: (row) => row.notes },
		// The duration as the grid shows it, and as decimal hours a spreadsheet can total
		time: {
			key: 'time',
			header: translate('REPORT_PAGE.TIME'),
			value: (row) => durationFormat.transform(row.duration)
		},
		// Exact, not rounded: rounding each entry drifts the column's sum away from the report's total (sixty
		// one-minute entries would sum to 1.2 hours rather than 1). Format the column to show fewer decimals.
		hours: {
			key: 'hours',
			header: translate('REPORT_PAGE.HOURS'),
			value: (row) => row.duration / 3600
		},
		activity: {
			key: 'activity',
			header: `${translate('REPORT_PAGE.ACTIVITY')} (%)`,
			value: (row) => row.activity
		}
	};
}

/**
 * The Time & Activity report as an export table: one row per time entry, in the grouping the grid shows,
 * with the grouping's column first.
 *
 * It only reshapes the rows the grid already fetched, so it exports exactly what the caller can see.
 *
 * @param logs - The report as the grid holds it.
 * @param groupBy - The grouping the report was read in.
 * @param translate - Translates a key of the UI's dictionary, for the column titles.
 * @returns The table to hand to `ReportExportService`.
 */
export function buildDailyReportExportTable(
	logs: ReadonlyArray<IReportDayData> | null | undefined,
	groupBy: ReportGroupByFilter,
	translate: (key: string) => string
): IReportExportTable<IDailyReportExportRow> {
	const columns = dailyReportColumns(translate);
	const grouping = columns[groupBy] ?? columns.date;
	const others = [columns.date, columns.employee, columns.project, columns.client].filter(
		(column) => column !== grouping
	);
	return {
		columns: [grouping, ...others, columns.task, columns.notes, columns.time, columns.hours, columns.activity],
		rows: flattenDailyReport(logs, groupBy)
	};
}
