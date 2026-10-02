import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExpensesReportComponent } from './expenses-report.component';
import { ExpensesReportModule } from '../expenses-report.module';
import { DateRangePickerBuilderService, DEFAULT_DATE_PICKER_CONFIG } from '@gauzy/ui-core/core';
describe('ExpensesReportComponent', () => {
	let component: ExpensesReportComponent;
	let fixture: ComponentFixture<ExpensesReportComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the NgModule that declares it, for the template's real scope.
			imports: [ExpensesReportModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		// In the app the page's route data sets this before the page renders; the template reads
		// `(datePickerConfig$ | async).isSaveDatePicker`, which is null until something does.
		TestBed.inject(DateRangePickerBuilderService).setDatePickerConfig(DEFAULT_DATE_PICKER_CONFIG);
		fixture = TestBed.createComponent(ExpensesReportComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
