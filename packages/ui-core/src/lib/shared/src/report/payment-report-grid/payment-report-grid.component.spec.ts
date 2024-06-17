import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentReportGridComponent } from './payment-report-grid.component';

describe('PaymentReportGridComponent', () => {
	let component: PaymentReportGridComponent;
	let fixture: ComponentFixture<PaymentReportGridComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [PaymentReportGridComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(PaymentReportGridComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
