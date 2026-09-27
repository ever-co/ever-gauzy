import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManualTimeComponent } from './manual-time.component';
import { ManualTimeModule } from '../manual-time.module';
import { DateRangePickerBuilderService, DEFAULT_DATE_PICKER_CONFIG } from '@gauzy/ui-core/core';
describe('ManualTimeComponent', () => {
	let component: ManualTimeComponent;
	let fixture: ComponentFixture<ManualTimeComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the NgModule that declares it, for the template's real scope.
			imports: [ManualTimeModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		// In the app the page's route data sets this before the page renders; the template reads
		// `(datePickerConfig$ | async).isSaveDatePicker`, which is null until something does.
		TestBed.inject(DateRangePickerBuilderService).setDatePickerConfig(DEFAULT_DATE_PICKER_CONFIG);
		fixture = TestBed.createComponent(ManualTimeComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});

