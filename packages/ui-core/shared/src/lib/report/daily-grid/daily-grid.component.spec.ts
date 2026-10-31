import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IReportDayData } from '@gauzy/contracts';
import { IReportExportTable, ReportExportService } from '../export';
import { DailyGridComponent } from './daily-grid.component';
import { IDailyReportExportRow } from './daily-report-export';
describe('DailyGridComponent', () => {
	let component: DailyGridComponent;
	let fixture: ComponentFixture<DailyGridComponent>;
	let reportExportService: { export: jest.Mock };
	beforeEach(async () => {
		reportExportService = { export: jest.fn() };
		await TestBed.configureTestingModule({
			declarations: [DailyGridComponent],
			providers: [{ provide: ReportExportService, useValue: reportExportService }],
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

	/** Exporting what the grid shows (#7527), for whichever page hosts it. */
	describe('export', () => {
		const report = [
			{
				date: '2026-10-01',
				logs: [
					{
						project: { id: 'p-1', name: 'Apollo' },
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

		const exported = () =>
			reportExportService.export.mock.calls[0] as [
				IReportExportTable<IDailyReportExportRow>,
				{ fileName: string; format: string }
			];

		beforeEach(() => {
			component.request = {
				...component.request,
				startDate: new Date(2026, 9, 1),
				endDate: new Date(2026, 9, 31, 23, 59, 59)
			};
		});

		it('has nothing to export until the report has loaded rows', () => {
			component.dailyLogs = [];
			expect(component.canExport).toBe(false);

			component.dailyLogs = report;
			component.loading = true;
			expect(component.canExport).toBe(false);

			component.loading = false;
			expect(component.canExport).toBe(true);
		});

		it('exports its rows as a CSV file named after the report and the selected range', () => {
			component.dailyLogs = report;

			component.exportReport();

			expect(reportExportService.export).toHaveBeenCalledTimes(1);
			const [table, options] = exported();
			expect(options).toEqual({ fileName: 'time-activity_2026-10-01_2026-10-31', format: 'csv' });
			expect(table.columns[0].key).toBe('date');
			expect(table.rows).toEqual([expect.objectContaining({ task: 'Build', duration: 5400 })]);
		});

		it('hands a format a plugin registered, and a report name, through to the export service', () => {
			component.dailyLogs = report;

			component.exportReport('xlsx', 'weekly-review');

			const [, options] = exported();
			expect(options).toEqual({ fileName: 'weekly-review_2026-10-01_2026-10-31', format: 'xlsx' });
		});

		it('does nothing without rows', () => {
			component.dailyLogs = [];

			component.exportReport();

			expect(reportExportService.export).not.toHaveBeenCalled();
		});
	});
});
