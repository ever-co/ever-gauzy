import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpensesReportGridComponent } from './expenses-report-grid.component';

describe('ExpensesReportGridComponent', () => {
	let component: ExpensesReportGridComponent;
	let fixture: ComponentFixture<ExpensesReportGridComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ExpensesReportGridComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(ExpensesReportGridComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
