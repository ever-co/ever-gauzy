import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimeLimitReportComponent } from './time-limit-report.component';

describe('TimeLimitReportComponent', () => {
	let component: TimeLimitReportComponent;
	let fixture: ComponentFixture<TimeLimitReportComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [TimeLimitReportComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(TimeLimitReportComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
