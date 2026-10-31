import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CurrencyPosition, IOrganization, ReportDayData } from '@gauzy/contracts';
import { DateRangePickerBuilderService, DEFAULT_DATE_PICKER_CONFIG, EmployeesService } from '@gauzy/ui-core/core';
import { WeeklyTimeReportsComponent } from './weekly-time-reports.component';
import { WeeklyTimeReportsModule } from '../weekly-time-reports.module';

describe('WeeklyTimeReportsComponent', () => {
	let component: WeeklyTimeReportsComponent;
	let fixture: ComponentFixture<WeeklyTimeReportsComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the NgModule that declares it, for the template's real scope.
			imports: [WeeklyTimeReportsModule],
			// Provided by the host feature module in the app (e.g. the reports parent).
			providers: [EmployeesService],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	beforeEach(() => {
		// In the app the page's route data sets this before the page renders.
		TestBed.inject(DateRangePickerBuilderService).setDatePickerConfig(DEFAULT_DATE_PICKER_CONFIG);
		fixture = TestBed.createComponent(WeeklyTimeReportsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	/** The Spent column (#4735): each employee's week priced at their bill rate, or a dash without a rate. */
	describe('Spent column', () => {
		const DAY = '2026-01-05';

		const week = (overrides: Partial<ReportDayData>): ReportDayData => ({
			employee: { id: 'e-1', user: { name: 'Ada Lovelace' } } as ReportDayData['employee'],
			dates: { [DAY]: { sum: 7200, logs: [] } },
			sum: 7200,
			activity: 50,
			...overrides
		});

		const spentCells = (): string[] =>
			Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.spent-cell')).map((cell) =>
				cell.textContent.trim()
			);

		const render = (logs: ReportDayData[]) => {
			component.organization = {
				id: 'o-1',
				currency: 'USD',
				currencyPosition: CurrencyPosition.LEFT
			} as IOrganization;
			component.weekDays = [DAY];
			component.weekLogs = logs;
			fixture.detectChanges();
		};

		it('shows the amount in the currency of the employee rate', () => {
			render([week({ spent: 80, currency: 'EUR' })]);

			const [cell] = spentCells();
			expect(cell).toContain('80.00');
			expect(cell).toContain('€');
		});

		it('falls back to the organization currency when the rate names none', () => {
			render([week({ spent: 12.5, currency: null })]);

			const [cell] = spentCells();
			expect(cell).toContain('12.50');
			expect(cell).toContain('$');
		});

		it('shows zero spent as an amount, not as a missing one', () => {
			render([week({ spent: 0, currency: 'USD' })]);

			expect(spentCells()[0]).toContain('0.00');
		});

		it('keeps the dash for an employee without a rate, and for an answer from before the column was priced', () => {
			render([week({ spent: null, currency: null }), week({ employee: { id: 'e-2' } as ReportDayData['employee'] })]);

			expect(spentCells()).toEqual(['—', '—']);
		});
	});

	describe('hasSpent', () => {
		it('is true only for a finite amount', () => {
			const base = { dates: {}, sum: 0, activity: 0 };

			expect(component.hasSpent({ ...base, spent: 10 })).toBe(true);
			expect(component.hasSpent({ ...base, spent: 0 })).toBe(true);
			expect(component.hasSpent({ ...base, spent: null })).toBe(false);
			expect(component.hasSpent({ ...base })).toBe(false);
			expect(component.hasSpent({ ...base, spent: Number.NaN })).toBe(false);
		});
	});
});
