import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimeActivitiesComponent } from './time-activities.component';

describe('TimeActivitiesComponent', () => {
	let component: TimeActivitiesComponent;
	let fixture: ComponentFixture<TimeActivitiesComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [TimeActivitiesComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(TimeActivitiesComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
