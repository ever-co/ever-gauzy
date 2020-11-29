import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpensesReportComponent } from './expenses-report.component';

describe('ExpensesReportComponent', () => {
	let component: ExpensesReportComponent;
	let fixture: ComponentFixture<ExpensesReportComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ExpensesReportComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(ExpensesReportComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
