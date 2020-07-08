import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TimeTrackerComponent } from './time-tracker.component';

describe('TimeTrackerComponent', () => {
	let component: TimeTrackerComponent;
	let fixture: ComponentFixture<TimeTrackerComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [TimeTrackerComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(TimeTrackerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
