import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectBudgetsReportComponent } from './project-budgets-report.component';

describe('ProjectBudgetsReportComponent', () => {
	let component: ProjectBudgetsReportComponent;
	let fixture: ComponentFixture<ProjectBudgetsReportComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ProjectBudgetsReportComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(ProjectBudgetsReportComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
