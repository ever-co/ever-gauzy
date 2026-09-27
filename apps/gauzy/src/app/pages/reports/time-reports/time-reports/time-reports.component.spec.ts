import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeReportsComponent } from './time-reports.component';
import { TimeReportsModule } from '../time-reports.module';
import { DateRangePickerBuilderService, DEFAULT_DATE_PICKER_CONFIG } from '@gauzy/ui-core/core';
describe('TimeReportsComponent', () => {
	let component: TimeReportsComponent;
	let fixture: ComponentFixture<TimeReportsComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the NgModule that declares it, for the template's real scope.
			imports: [TimeReportsModule],
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
});

