import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IOrganization, IReportDayData, ReportGroupFilterEnum } from '@gauzy/contracts';
import {
	DateRangePickerBuilderService,
	DEFAULT_DATE_PICKER_CONFIG,
	EmployeesService,
	TimesheetService
} from '@gauzy/ui-core/core';
import { IDailyReportExportRow, IReportExportTable, ReportExportService } from '@gauzy/ui-core/shared';
import { TimeActivitiesComponent } from './time-activities.component';
import { TimeAndActivitiesModule } from '../time-activities.module';

/** Lets the grid's `await` continuations run. */
const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('TimeActivitiesComponent', () => {
	let component: TimeActivitiesComponent;
	let fixture: ComponentFixture<TimeActivitiesComponent>;
	let reportExportService: { export: jest.Mock };

	beforeEach(async () => {
		reportExportService = { export: jest.fn() };
		await TestBed.configureTestingModule({
			// Not standalone: import the NgModule that declares it, for the template's real scope.
			imports: [TimeAndActivitiesModule],
			// Provided by the host feature module in the app (e.g. the employees/reports parents).
			providers: [EmployeesService, { provide: ReportExportService, useValue: reportExportService }],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		// In the app the page's route data sets this before the page renders; the template reads
		// `(datePickerConfig$ | async).isSaveDatePicker`, which is null until something does.
		TestBed.inject(DateRangePickerBuilderService).setDatePickerConfig(DEFAULT_DATE_PICKER_CONFIG);
		fixture = TestBed.createComponent(TimeActivitiesComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});

	/** The Export to CSV action (#7527), on the employee's Activity → Time & Activity tab. */
	describe('Export to CSV', () => {
		const report = [
			{
				project: { id: 'p-1', name: 'Apollo' },
				logs: [
					{
						date: '2026-10-01',
						employeeLogs: [
							{
								employee: { id: 'e-1', fullName: 'Ada Lovelace' },
								activity: 55.5,
								tasks: [{ task: { title: 'Build' }, description: 'Wired the export', duration: 5400 }]
							}
						]
					}
				]
			}
		] as unknown as IReportDayData[];

		/** The same day as the date grouping answers it: the shape the grid reads before the grouping changes. */
		const reportByDate = [
			{
				date: '2026-10-01',
				logs: [
					{
						project: { id: 'p-1', name: 'Apollo' },
						employeeLogs: [
							{
								employee: { id: 'e-1', fullName: 'Ada Lovelace' },
								activity: 55.5,
								tasks: [{ task: { title: 'Stale' }, description: 'Older answer', duration: 60 }]
							}
						]
					}
				]
			}
		] as unknown as IReportDayData[];

		const button = (): HTMLButtonElement => fixture.nativeElement.querySelector('.export-csv-button');

		/** The grid's report requests, each answered when the test says so. */
		let answers: ((logs: IReportDayData[]) => void)[];

		beforeEach(() => {
			answers = [];
			jest.spyOn(TestBed.inject(TimesheetService), 'getDailyReport').mockImplementation(
				() => new Promise<IReportDayData[]>((resolve) => answers.push(resolve))
			);
			// The date range the grid reads the report for
			component.dailyGrid.request = {
				...component.dailyGrid.request,
				startDate: new Date(2026, 9, 1),
				endDate: new Date(2026, 9, 31, 23, 59, 59)
			};
		});

		/** Selects the organization, as the header selector does: the grid requests the report. */
		const selectOrganization = () => {
			component.dailyGrid.organization = { id: 'org-1', tenantId: 'tenant-1' } as IOrganization;
			component.dailyGrid.subject$.next(true);
			fixture.detectChanges();
		};

		/** Answers the grid's report request at this position. */
		const answer = async (index: number, logs: IReportDayData[]) => {
			answers[index](logs);
			await flush();
			fixture.detectChanges();
		};

		/** Loads the grid with one answered request. */
		const loadGrid = async (logs: IReportDayData[]) => {
			selectOrganization();
			await answer(answers.length - 1, logs);
		};

		const exported = () =>
			reportExportService.export.mock.calls[0] as [
				IReportExportTable<IDailyReportExportRow>,
				{ fileName: string; format: string }
			];

		it('shows the action after the filters, disabled while the grid has no rows', async () => {
			await loadGrid([]);

			expect(button()).not.toBeNull();
			expect(button().disabled).toBe(true);
			expect(component.canExport).toBe(false);
			// Projected into the filter row's trailing slot, so it follows the built-in filters
			const filterRow: HTMLElement = fixture.nativeElement.querySelector('.filter-item-list');
			expect(filterRow.lastElementChild?.classList).toContain('export-action');
		});

		it('stays disabled while the grid is loading', () => {
			selectOrganization();

			expect(component.dailyGrid.loading).toBe(true);
			expect(button().disabled).toBe(true);
		});

		it('exports the loaded rows, in the selected grouping, named after the selected range', async () => {
			// The page's own Group by select drives the grid here
			component.groupBy = ReportGroupFilterEnum.project;
			fixture.detectChanges();
			await loadGrid(report);

			expect(button().disabled).toBe(false);
			button().click();

			expect(reportExportService.export).toHaveBeenCalledTimes(1);
			const [table, options] = exported();
			expect(options).toEqual({ fileName: 'time-activity_2026-10-01_2026-10-31', format: 'csv' });
			// The project grouping puts its own column first
			expect(table.columns[0].key).toBe('project');
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

		it('stays disabled until the request for a new grouping answers, and exports that grouping', async () => {
			selectOrganization();
			// The user switches to the project grouping before the date grouping's request answers
			component.groupBy = ReportGroupFilterEnum.project;
			fixture.detectChanges();

			await answer(0, reportByDate);
			expect(component.dailyGrid.dailyLogs).toEqual([]);
			expect(button().disabled).toBe(true);

			await answer(1, report);
			expect(button().disabled).toBe(false);
			button().click();

			const [table] = exported();
			expect(table.columns[0].key).toBe('project');
			expect(table.rows).toEqual([expect.objectContaining({ project: 'Apollo', task: 'Build', duration: 5400 })]);
		});
	});
});
