import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimeReportsComponent } from './time-reports.component';

describe('TimeReportsComponent', () => {
	let component: TimeReportsComponent;
	let fixture: ComponentFixture<TimeReportsComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [TimeReportsComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(TimeReportsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
