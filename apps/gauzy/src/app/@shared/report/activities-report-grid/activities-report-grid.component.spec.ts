import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActivitiesReportGridComponent } from './activities-report-grid.component';

describe('ActivitiesReportGridComponent', () => {
	let component: ActivitiesReportGridComponent;
	let fixture: ComponentFixture<ActivitiesReportGridComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ActivitiesReportGridComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(ActivitiesReportGridComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
