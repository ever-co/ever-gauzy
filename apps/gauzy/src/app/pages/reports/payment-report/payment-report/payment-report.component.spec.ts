import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaymentReportComponent } from './payment-report.component';
import { PaymentReportModule } from '../payment-report.module';
import { DateRangePickerBuilderService, DEFAULT_DATE_PICKER_CONFIG } from '@gauzy/ui-core/core';
describe('PaymentReportComponent', () => {
	let component: PaymentReportComponent;
	let fixture: ComponentFixture<PaymentReportComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the NgModule that declares it, for the template's real scope.
			imports: [PaymentReportModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		// In the app the page's route data sets this before the page renders; the template reads
		// `(datePickerConfig$ | async).isSaveDatePicker`, which is null until something does.
		TestBed.inject(DateRangePickerBuilderService).setDatePickerConfig(DEFAULT_DATE_PICKER_CONFIG);
		fixture = TestBed.createComponent(PaymentReportComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});

