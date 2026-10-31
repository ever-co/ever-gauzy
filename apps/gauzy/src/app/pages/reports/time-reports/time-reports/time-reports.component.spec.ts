import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IOrganization, IReportDayData, ReportGroupFilterEnum } from '@gauzy/contracts';
import {
	DateRangePickerBuilderService,
	DEFAULT_DATE_PICKER_CONFIG,
	EmployeesService,
	TimesheetService
} from '@gauzy/ui-core/core';
import { IDailyReportExportRow, IReportExportTable, ReportExportService } from '@gauzy/ui-core/shared';
import { TimeReportsComponent } from './time-reports.component';
import { TimeReportsModule } from '../time-reports.module';

/** Lets the grid's `await` continuations run. */
const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('TimeReportsComponent', () => {
	let component: TimeReportsComponent;
	let fixture: ComponentFixture<TimeReportsComponent>;
	let reportExportService: { export: jest.Mock };

	beforeEach(async () => {
		reportExportService = { export: jest.fn() };
		await TestBed.configureTestingModule({
			// Not standalone: import the NgModule that declares it, for the template's real scope.
			imports: [TimeReportsModule],
			// Provided by the host feature module in the app (e.g. the employees/reports parents).
			providers: [EmployeesService, { provide: ReportExportService, useValue: reportExportService }],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		// In the app the page's route data sets this before the page renders; the template reads
		// `(datePickerConfig$ | async).isSaveDatePicker`, which is null until something does.
		TestBed.inject(DateRangePickerBuilderService).setDatePickerConfig(DEFAULT_DATE_PICKER_CONFIG);
		fixture = TestBed.createComponent(TimeReportsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});

	/** The Export to CSV action (#7527): the rows the grid shows, in its grouping, for the selected range. */
	describe('Export to CSV', () => {
		/** The report as the employee grouping answers it, with one entry of this task. */
		const reportOf = (task: string, duration = 5400) =>
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
									tasks: [{ task: { title: task }, description: 'Wired the export', duration }]
								}
							]
						}
					]
				}
			] as unknown as IReportDayData[];
		const report = reportOf('Build');

		const button = (): HTMLButtonElement => fixture.nativeElement.querySelector('.export-csv-button');

		/** The grid's report requests, each answered when the test says so. */
		let answers: ((logs: IReportDayData[]) => void)[];

		beforeEach(() => {
			answers = [];
			jest.spyOn(TestBed.inject(TimesheetService), 'getDailyReport').mockImplementation(
				() => new Promise<IReportDayData[]>((resolve) => answers.push(resolve))
			);
		});

		/** Selects a date range, as the header's selectors do: the grid requests the report for it. */
		const selectRange = (startDate: Date, endDate: Date) => {
			component.dailyGrid.organization = { id: 'org-1', tenantId: 'tenant-1' } as IOrganization;
			component.dailyGrid.request = { ...component.dailyGrid.request, startDate, endDate };
			component.dailyGrid.subject$.next(true);
			fixture.detectChanges();
		};
		const selectOctober = () => selectRange(new Date(2026, 9, 1), new Date(2026, 9, 31, 23, 59, 59));
		const selectNovember = () => selectRange(new Date(2026, 10, 1), new Date(2026, 10, 30, 23, 59, 59));

		/** Answers the grid's report request at this position. */
		const answer = async (index: number, logs: IReportDayData[]) => {
			answers[index](logs);
			await flush();
			fixture.detectChanges();
		};

		/** Loads the grid with one answered request, for October. */
		const loadGrid = async (logs: IReportDayData[]) => {
			selectOctober();
			await answer(answers.length - 1, logs);
		};

		const exported = () =>
			reportExportService.export.mock.calls[0] as [
				IReportExportTable<IDailyReportExportRow>,
				{ fileName: string; format: string }
			];

		it('shows the action, disabled while the grid has no rows', async () => {
			await loadGrid([]);

			expect(button()).not.toBeNull();
			expect(button().disabled).toBe(true);
			expect(component.canExport).toBe(false);
		});

		it('stays disabled while the grid is loading', () => {
			selectOctober();

			expect(component.dailyGrid.loading).toBe(true);
			expect(button().disabled).toBe(true);
		});

		it('exports the loaded rows, in the grid grouping, named after the selected range', async () => {
			// The grid's own grouping input
			component.dailyGrid.groupBy = ReportGroupFilterEnum.employee;
			await loadGrid(report);

			expect(button().disabled).toBe(false);
			button().click();

			expect(reportExportService.export).toHaveBeenCalledTimes(1);
			const [table, options] = exported();
			expect(options).toEqual({ fileName: 'time-activity_2026-10-01_2026-10-31', format: 'csv' });
			// The employee grouping puts its own column first
			expect(table.columns[0].key).toBe('employee');
			expect(table.rows).toEqual([
				{
					date: '2026-10-01',
					employee: 'Ada Lovelace',
					project: 'Apollo',
					client: '',
					task: 'Build',
					notes: 'Wired the export',
					duration: 5400,
					activity: 55.5
				}
			]);
		});

		it('does nothing when called without rows', async () => {
			await loadGrid([]);

			component.exportToCsv();

			expect(reportExportService.export).not.toHaveBeenCalled();
		});

		it('exports the newer range when the older range’s request answers last', async () => {
			component.dailyGrid.groupBy = ReportGroupFilterEnum.employee;
			selectOctober();
			selectNovember();

			await answer(1, reportOf('November'));
			await answer(0, reportOf('October'));

			// The older answer neither replaced the newer rows nor touched the loading state
			expect(component.dailyGrid.loading).toBe(false);
			expect(button().disabled).toBe(false);
			button().click();

			const [table, options] = exported();
			expect(options.fileName).toBe('time-activity_2026-11-01_2026-11-30');
			expect(table.rows.map(({ task }) => task)).toEqual(['November']);
		});

		it('stays disabled while the newer range loads, even when the older range’s request answers first', async () => {
			selectOctober();
			selectNovember();

			await answer(0, reportOf('October'));

			expect(component.dailyGrid.loading).toBe(true);
			expect(button().disabled).toBe(true);
		});
	});
});
