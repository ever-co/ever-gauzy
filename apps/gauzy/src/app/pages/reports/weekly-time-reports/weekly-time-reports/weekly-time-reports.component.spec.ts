import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeeklyTimeReportsComponent } from './weekly-time-reports.component';

describe('WeeklyTimeReportsComponent', () => {
	let component: WeeklyTimeReportsComponent;
	let fixture: ComponentFixture<WeeklyTimeReportsComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [WeeklyTimeReportsComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(WeeklyTimeReportsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
