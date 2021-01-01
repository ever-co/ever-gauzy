import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientBudgetsReportComponent } from './client-budgets-report.component';

describe('ClientBudgetsReportComponent', () => {
	let component: ClientBudgetsReportComponent;
	let fixture: ComponentFixture<ClientBudgetsReportComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ClientBudgetsReportComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(ClientBudgetsReportComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
