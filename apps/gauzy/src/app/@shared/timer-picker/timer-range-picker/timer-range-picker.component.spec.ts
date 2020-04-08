import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TimerRangePickerComponent } from './timer-range-picker.component';

describe('TimerRangePickerComponent', () => {
	let component: TimerRangePickerComponent;
	let fixture: ComponentFixture<TimerRangePickerComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [TimerRangePickerComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(TimerRangePickerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
