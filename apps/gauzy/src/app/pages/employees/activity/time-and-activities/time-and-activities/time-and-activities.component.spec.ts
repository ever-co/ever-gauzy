import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimeAndActivitiesComponent } from './time-and-activities.component';

describe('TimeAndActivitiesComponent', () => {
	let component: TimeAndActivitiesComponent;
	let fixture: ComponentFixture<TimeAndActivitiesComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [TimeAndActivitiesComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(TimeAndActivitiesComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
