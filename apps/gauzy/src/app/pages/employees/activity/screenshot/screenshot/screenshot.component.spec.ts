import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScreenshotComponent } from './screenshot.component';
import { ScreenshotModule } from '../screenshot.module';
import { DateRangePickerBuilderService, DEFAULT_DATE_PICKER_CONFIG, EmployeesService } from '@gauzy/ui-core/core';
describe('ScreenshotComponent', () => {
	let component: ScreenshotComponent;
	let fixture: ComponentFixture<ScreenshotComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the NgModule that declares it, for the template's real scope.
			imports: [ScreenshotModule],
			// Provided by the host feature module in the app (e.g. the employees/reports parents).
			providers: [EmployeesService],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		// In the app the page's route data sets this before the page renders; the template reads
		// `(datePickerConfig$ | async).isSaveDatePicker`, which is null until something does.
		TestBed.inject(DateRangePickerBuilderService).setDatePickerConfig(DEFAULT_DATE_PICKER_CONFIG);
		fixture = TestBed.createComponent(ScreenshotComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
