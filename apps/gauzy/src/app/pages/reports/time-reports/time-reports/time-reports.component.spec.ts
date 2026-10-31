import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IReportDayData, ReportGroupFilterEnum } from '@gauzy/contracts';
import { DateRangePickerBuilderService, DEFAULT_DATE_PICKER_CONFIG, EmployeesService } from '@gauzy/ui-core/core';
import { IDailyReportExportRow, IReportExportTable, ReportExportService } from '@gauzy/ui-core/shared';
import { TimeReportsComponent } from './time-reports.component';
import { TimeReportsModule } from '../time-reports.module';

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
		const report = [
			{
				employee: { id: 'e-1', fullName: 'Ada Lovelace' },
				logs: [
					{
						date: '2026-10-01',
						projectLogs: [
							{
								project: { id: 'p-1', name: 'Apollo' },
								activity: 55.5,
								tasks: [{ task: { title: 'Build' }, description: 'Wired the export', duration: 5400 }]
							}
						]
					}
				]
			}
		] as unknown as IReportDayData[];

		const button = (): HTMLButtonElement => fixture.nativeElement.querySelector('.export-csv-button');

		const loadGrid = (logs: IReportDayData[], loading = false) => {
			component.dailyGrid.dailyLogs = logs;
			component.dailyGrid.loading = loading;
			fixture.detectChanges();
		};

		it('shows the action, disabled while the grid has no rows', () => {
			loadGrid([]);

			expect(button()).not.toBeNull();
			expect(button().disabled).toBe(true);
			expect(component.canExport).toBe(false);
		});

		it('stays disabled while the grid is loading', () => {
			loadGrid(report, true);

			expect(button().disabled).toBe(true);
		});

		it('exports the loaded rows, in the grid grouping, named after the selected range', () => {
			// The date range the grid read the report for
			component.dailyGrid.request = {
				...component.dailyGrid.request,
				startDate: new Date(2026, 9, 1),
				endDate: new Date(2026, 9, 31, 23, 59, 59)
			};
			// The grid's own grouping input; its setter only reloads when the grouping changes
			component.dailyGrid.groupBy = ReportGroupFilterEnum.employee;
			loadGrid(report);

			expect(button().disabled).toBe(false);
			button().click();

			expect(reportExportService.export).toHaveBeenCalledTimes(1);
			const [table, options] = reportExportService.export.mock.calls[0] as [
				IReportExportTable<IDailyReportExportRow>,
				{ fileName: string; format: string }
			];
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

		it('does nothing when called without rows', () => {
			loadGrid([]);

			component.exportToCsv();

			expect(reportExportService.export).not.toHaveBeenCalled();
		});
	});
});
