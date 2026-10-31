import { IReportDayData, ReportGroupFilterEnum } from '@gauzy/contracts';
import { CsvReportExporter } from '../export/csv-report-exporter';
import { buildDailyReportExportTable, flattenDailyReport, IDailyReportExportRow } from './daily-report-export';

/*
 * The four shapes `GET /timesheet/time-log/report/daily` answers, one per grouping, for the same two entries:
 * Ada, on 2026-10-01, on the Apollo project for the Acme client — 1.5 hours on "Build", 30 minutes with no task.
 */
const ada = { id: 'e-1', fullName: 'Ada Lovelace', user: { name: 'Ada Lovelace' } };
const apollo = { id: 'p-1', name: 'Apollo' };
const acme = { id: 'c-1', name: 'Acme' };
const tasks = [
	{ task: { id: 't-1', title: 'Build' }, description: 'Wired the export', duration: 5400, client: acme },
	{ task: null, description: null, duration: 1800, client: acme }
];

const byDate = [
	{
		date: '2026-10-01',
		sum: 7200,
		activity: 40,
		logs: [{ project: apollo, employeeLogs: [{ employee: ada, sum: 7200, activity: 55.5, tasks }] }]
	}
];
const byEmployee = [
	{
		employee: ada,
		sum: 7200,
		activity: 40,
		logs: [{ date: '2026-10-01', projectLogs: [{ project: apollo, sum: 7200, activity: 55.5, tasks }] }]
	}
];
const byProject = [
	{
		project: apollo,
		sum: 7200,
		activity: 40,
		logs: [{ date: '2026-10-01', employeeLogs: [{ employee: ada, sum: 7200, activity: 55.5, tasks }] }]
	}
];
// The client grouping's tasks carry no client: the group names it
const byClient = [
	{
		client: acme,
		sum: 7200,
		activity: 40,
		logs: [
			{
				project: apollo,
				logs: [
					{
						date: '2026-10-01',
						projectLogs: [
							{
								employee: ada,
								sum: 7200,
								activity: 55.5,
								tasks: tasks.map(({ task, description, duration }) => ({ task, description, duration }))
							}
						]
					}
				]
			}
		]
	}
];

const asReport = (groups: unknown[]) => groups as IReportDayData[];

const expectedRows: IDailyReportExportRow[] = [
	{
		date: '2026-10-01',
		employee: 'Ada Lovelace',
		project: 'Apollo',
		client: 'Acme',
		task: 'Build',
		notes: 'Wired the export',
		duration: 5400,
		activity: 55.5
	},
	{
		date: '2026-10-01',
		employee: 'Ada Lovelace',
		project: 'Apollo',
		client: 'Acme',
		task: '',
		notes: '',
		duration: 1800,
		activity: 55.5
	}
];

describe('flattenDailyReport', () => {
	it.each([
		[ReportGroupFilterEnum.date, byDate],
		[ReportGroupFilterEnum.employee, byEmployee],
		[ReportGroupFilterEnum.project, byProject],
		[ReportGroupFilterEnum.client, byClient]
	])('reads one row per time entry from the %s grouping', (groupBy, report) => {
		expect(flattenDailyReport(asReport(report), groupBy)).toEqual(expectedRows);
	});

	it('keeps the order of the groups, as the grid shows them', () => {
		const grace = { id: 'e-2', user: { firstName: 'Grace', lastName: 'Hopper' } };
		const report = [
			byDate[0],
			{
				date: '2026-10-02',
				logs: [{ project: null, employeeLogs: [{ employee: grace, activity: 10, tasks: [{ duration: 60 }] }] }]
			}
		];

		const rows = flattenDailyReport(asReport(report), ReportGroupFilterEnum.date);

		expect(rows.map((row) => row.date)).toEqual(['2026-10-01', '2026-10-01', '2026-10-02']);
		// A name from the user when the employee carries none, and no project is an empty cell
		expect(rows[2]).toEqual(
			expect.objectContaining({ employee: 'Grace Hopper', project: '', client: '', duration: 60, activity: 10 })
		);
	});

	it('answers no rows for no report', () => {
		expect(flattenDailyReport(null, ReportGroupFilterEnum.date)).toEqual([]);
		expect(flattenDailyReport([], ReportGroupFilterEnum.client)).toEqual([]);
	});

	it('survives groups the API answered without their nested lists', () => {
		const report = [{ date: '2026-10-01' }, { date: '2026-10-02', logs: [{ project: apollo }] }];

		expect(flattenDailyReport(asReport(report), ReportGroupFilterEnum.date)).toEqual([]);
	});
});

describe('buildDailyReportExportTable', () => {
	const translate = (key: string) => `T(${key})`;

	it.each([
		[ReportGroupFilterEnum.date, ['date', 'employee', 'project', 'client']],
		[ReportGroupFilterEnum.employee, ['employee', 'date', 'project', 'client']],
		[ReportGroupFilterEnum.project, ['project', 'date', 'employee', 'client']],
		[ReportGroupFilterEnum.client, ['client', 'date', 'employee', 'project']]
	])('puts the %s grouping column first', (groupBy, leading) => {
		const table = buildDailyReportExportTable([], groupBy, translate);

		expect(table.columns.map((column) => column.key)).toEqual([
			...leading,
			'task',
			'notes',
			'time',
			'hours',
			'activity'
		]);
	});

	it('titles the columns with the grid translations', () => {
		const table = buildDailyReportExportTable([], ReportGroupFilterEnum.date, translate);

		expect(table.columns.map((column) => column.header)).toEqual([
			'T(REPORT_PAGE.DATE)',
			'T(REPORT_PAGE.EMPLOYEE)',
			'T(REPORT_PAGE.PROJECT)',
			'T(REPORT_PAGE.CLIENT)',
			'T(REPORT_PAGE.TO_DO)',
			'T(REPORT_PAGE.NOTES)',
			'T(REPORT_PAGE.TIME)',
			'T(REPORT_PAGE.HOURS)',
			'T(REPORT_PAGE.ACTIVITY) (%)'
		]);
	});

	it('writes the duration as the grid shows it and as decimal hours that sum to the report total', () => {
		const csv = new CsvReportExporter().toCsv(
			buildDailyReportExportTable(asReport(byDate), ReportGroupFilterEnum.date, translate)
		);
		const [, first, second] = csv.split('\r\n');

		expect(first).toBe(
			'"2026-10-01","Ada Lovelace","Apollo","Acme","Build","Wired the export","01:30:00",1.5,55.5'
		);
		expect(second).toBe('"2026-10-01","Ada Lovelace","Apollo","Acme","","","00:30:00",0.5,55.5');
	});

	it.each([
		['sixty one-minute entries', 60, 60],
		['three twenty-minute entries', 3, 1200],
		['ninety forty-second entries', 90, 40]
	])('exports hours that add up to the report total for %s', (_label, entries, duration) => {
		const report = [
			{
				date: '2026-10-01',
				logs: [
					{
						project: apollo,
						employeeLogs: [
							{
								employee: ada,
								sum: entries * duration,
								activity: 0,
								tasks: Array.from({ length: entries }, () => ({ duration }))
							}
						]
					}
				]
			}
		];
		const table = buildDailyReportExportTable(asReport(report), ReportGroupFilterEnum.date, translate);
		const hours = table.columns.find((column) => column.key === 'hours');

		const total = table.rows.reduce((sum, row) => sum + Number(hours?.value(row)), 0);

		// One hour of time sums to one hour: rounding each entry to 2 decimals summed to 1.2, 0.99 and 0.9
		expect(total).toBeCloseTo(1, 10);
	});

	it('neutralizes a note that a spreadsheet would run as a formula', () => {
		const report = [
			{
				date: '2026-10-01',
				logs: [
					{
						project: apollo,
						employeeLogs: [
							{ employee: ada, activity: 0, tasks: [{ description: '=HYPERLINK("x")', duration: 60 }] }
						]
					}
				]
			}
		];

		const csv = new CsvReportExporter().toCsv(
			buildDailyReportExportTable(asReport(report), ReportGroupFilterEnum.date, translate)
		);

		expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
	});
});
