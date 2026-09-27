import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeActivitiesComponent } from './time-activities.component';
import { TimeAndActivitiesModule } from '../time-activities.module';
import { DateRangePickerBuilderService, DEFAULT_DATE_PICKER_CONFIG, EmployeesService } from '@gauzy/ui-core/core';
describe('TimeActivitiesComponent', () => {
	let component: TimeActivitiesComponent;
	let fixture: ComponentFixture<TimeActivitiesComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the NgModule that declares it, for the template's real scope.
			imports: [TimeAndActivitiesModule],
			// Provided by the host feature module in the app (e.g. the employees/reports parents).
			providers: [EmployeesService],
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
});
