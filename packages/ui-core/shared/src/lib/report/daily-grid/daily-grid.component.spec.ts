import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IGetTimeLogReportInput, IOrganization, IReportDayData, ReportGroupFilterEnum, TimeLogType } from '@gauzy/contracts';
import { TimesheetService } from '@gauzy/ui-core/core';
import { IReportExportTable, ReportExportService } from '../export';
import { DailyGridComponent } from './daily-grid.component';
import { IDailyReportExportRow } from './daily-report-export';

/** One report request the grid sent, answered when the test says so. */
interface IPendingReport {
	payload: IGetTimeLogReportInput;
	resolve: (logs: IReportDayData[]) => void;
	reject: (error: unknown) => void;
}

/** Lets the grid's `await` continuations run. */
const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('DailyGridComponent', () => {
	let component: DailyGridComponent;
	let fixture: ComponentFixture<DailyGridComponent>;
	let reportExportService: { export: jest.Mock };
	let timesheetService: { getDailyReport: jest.Mock };
	let requests: IPendingReport[];

	beforeEach(async () => {
		reportExportService = { export: jest.fn() };
		requests = [];
		timesheetService = {
			getDailyReport: jest.fn(
				(payload: IGetTimeLogReportInput) =>
					new Promise<IReportDayData[]>((resolve, reject) => requests.push({ payload, resolve, reject }))
			)
		};
		await TestBed.configureTestingModule({
			declarations: [DailyGridComponent],
			providers: [
				{ provide: ReportExportService, useValue: reportExportService },
				{ provide: TimesheetService, useValue: timesheetService }
			],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(DailyGridComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});

	/** The report as the date grouping answers it. */
	const byDate = (task: string) =>
		[
			{
				date: '2026-10-01',
				logs: [
					{
						project: { id: 'p-1', name: 'Apollo' },
						employeeLogs: [
							{
								employee: { id: 'e-1', fullName: 'Ada Lovelace' },
								activity: 55.5,
								tasks: [{ task: { title: task }, description: 'Wired the export', duration: 5400 }]
							}
						]
					}
				]
			}
		] as unknown as IReportDayData[];

	/** The report as the employee grouping answers it. */
	const byEmployee = (task: string) =>
		[
			{
				employee: { id: 'e-1', fullName: 'Ada Lovelace' },
				logs: [
					{
						date: '2026-10-01',
						projectLogs: [
							{
								project: { id: 'p-1', name: 'Apollo' },
								activity: 55.5,
								tasks: [{ task: { title: task }, description: 'Wired the export', duration: 5400 }]
							}
						]
					}
				]
			}
		] as unknown as IReportDayData[];

	/** Selects an organization and a date range, as the header selectors do: the grid requests the report. */
	const selectOrganization = () => {
		component.organization = { id: 'org-1', tenantId: 'tenant-1' } as IOrganization;
		component.subject$.next(true);
	};

	/** Answers the report request at this position, and lets the grid apply (or drop) the answer. */
	const answer = async (index: number, logs: IReportDayData[]) => {
		requests[index].resolve(logs);
		await flush();
	};

	const fail = async (index: number, error: unknown) => {
		requests[index].reject(error);
		await flush();
	};

	const exported = () =>
		reportExportService.export.mock.calls[0] as [
			IReportExportTable<IDailyReportExportRow>,
			{ fileName: string; format: string }
		];

	const exportedTasks = () => exported()[0].rows.map(({ task }) => task);

	beforeEach(() => {
		component.request = {
			...component.request,
			startDate: new Date(2026, 9, 1),
			endDate: new Date(2026, 9, 31, 23, 59, 59)
		};
	});

	/** Exporting what the grid shows (#7527), for whichever page hosts it. */
	describe('export', () => {
		it('has nothing to export while the report is loading or found no time entries', async () => {
			selectOrganization();
			expect(component.loading).toBe(true);
			expect(component.canExport).toBe(false);

			await answer(0, []);
			expect(component.loading).toBe(false);
			expect(component.canExport).toBe(false);

			component.groupBy = ReportGroupFilterEnum.employee;
			await answer(1, byEmployee('Build'));
			expect(component.canExport).toBe(true);
		});

		it('exports its rows as a CSV file named after the report and the selected range', async () => {
			selectOrganization();
			await answer(0, byDate('Build'));

			component.exportReport();

			expect(reportExportService.export).toHaveBeenCalledTimes(1);
			const [table, options] = exported();
			expect(options).toEqual({ fileName: 'time-activity_2026-10-01_2026-10-31', format: 'csv' });
			expect(table.columns[0].key).toBe('date');
			expect(table.rows).toEqual([expect.objectContaining({ task: 'Build', duration: 5400 })]);
		});

		it('hands a format a plugin registered, and a report name, through to the export service', async () => {
			selectOrganization();
			await answer(0, byDate('Build'));

			component.exportReport('xlsx', 'weekly-review');

			const [, options] = exported();
			expect(options).toEqual({ fileName: 'weekly-review_2026-10-01_2026-10-31', format: 'xlsx' });
		});

		it('does nothing without rows', async () => {
			selectOrganization();
			await answer(0, []);

			component.exportReport();

			expect(reportExportService.export).not.toHaveBeenCalled();
		});

		it('does nothing while the report is loading', () => {
			selectOrganization();

			component.exportReport();

			expect(reportExportService.export).not.toHaveBeenCalled();
		});
	});

	/**
	 * Every filter or grouping change requests the report again, and the requests can overlap: only the latest
	 * shows its rows, ends the loading state and can be exported (#11601 review of #7527).
	 */
	describe('overlapping requests', () => {
		it('keeps the newer rows, and the loading state they ended, when an older request answers last', async () => {
			selectOrganization();
			component.filters = { logType: [TimeLogType.MANUAL] };
			expect(requests.map(({ payload }) => payload.logType)).toEqual([undefined, [TimeLogType.MANUAL]]);

			await answer(1, byDate('Newer'));
			expect(component.canExport).toBe(true);

			await answer(0, byDate('Older'));
			expect(component.dailyLogs).toEqual(byDate('Newer'));
			expect(component.loading).toBe(false);

			component.exportReport();
			expect(exportedTasks()).toEqual(['Newer']);
		});

		it('stays loading, with nothing on screen to export, when an older request answers first', async () => {
			selectOrganization();
			component.filters = { logType: [TimeLogType.MANUAL] };

			await answer(0, byDate('Older'));
			expect(component.loading).toBe(true);
			expect(component.dailyLogs).toEqual([]);
			expect(component.canExport).toBe(false);
			component.exportReport();
			expect(reportExportService.export).not.toHaveBeenCalled();

			await answer(1, byDate('Newer'));
			expect(component.loading).toBe(false);
			expect(component.canExport).toBe(true);
		});

		it('exports the newer grouping, never reading an older answer in the new shape', async () => {
			selectOrganization();
			component.groupBy = ReportGroupFilterEnum.employee;
			expect(requests.map(({ payload }) => payload.groupBy)).toEqual([
				ReportGroupFilterEnum.date,
				ReportGroupFilterEnum.employee
			]);

			// The date grouping's answer lands after the grouping changed: it is not the employee report
			await answer(0, byDate('Older'));
			expect(component.dailyLogs).toEqual([]);
			expect(component.canExport).toBe(false);

			await answer(1, byEmployee('Newer'));
			component.exportReport();

			const [table] = exported();
			expect(table.columns[0].key).toBe('employee');
			expect(table.rows).toEqual([
				expect.objectContaining({ employee: 'Ada Lovelace', project: 'Apollo', task: 'Newer' })
			]);
		});

		it('ignores an older request that fails, and keeps loading for the newer one', async () => {
			const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
			try {
				selectOrganization();
				component.groupBy = ReportGroupFilterEnum.employee;

				await fail(0, new Error('timeout'));
				expect(component.loading).toBe(true);
				expect(consoleError).not.toHaveBeenCalled();

				await answer(1, byEmployee('Newer'));
				expect(component.canExport).toBe(true);
			} finally {
				consoleError.mockRestore();
			}
		});

		it('ends loading with nothing to export when the latest request fails', async () => {
			const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
			try {
				selectOrganization();
				await answer(0, byDate('Older'));
				component.groupBy = ReportGroupFilterEnum.employee;

				await fail(1, new Error('timeout'));

				expect(component.loading).toBe(false);
				expect(component.dailyLogs).toEqual([]);
				expect(component.canExport).toBe(false);
				expect(consoleError).toHaveBeenCalledTimes(1);
			} finally {
				consoleError.mockRestore();
			}
		});

		it('keeps its rows exportable when the filters are set again to the same values', async () => {
			selectOrganization();
			await answer(0, byDate('Build'));

			component.filters = { ...component.filters };
			component.groupBy = ReportGroupFilterEnum.date;

			expect(timesheetService.getDailyReport).toHaveBeenCalledTimes(1);
			expect(component.canExport).toBe(true);
		});
	});
});
