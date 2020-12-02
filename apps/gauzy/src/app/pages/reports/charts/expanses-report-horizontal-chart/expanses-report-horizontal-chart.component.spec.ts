import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpansesReportHorizontalChartComponent } from './expanses-report-horizontal-chart.component';

describe('ExpansesReportHorizontalChartComponent', () => {
	let component: ExpansesReportHorizontalChartComponent;
	let fixture: ComponentFixture<ExpansesReportHorizontalChartComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ExpansesReportHorizontalChartComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(
			ExpansesReportHorizontalChartComponent
		);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
