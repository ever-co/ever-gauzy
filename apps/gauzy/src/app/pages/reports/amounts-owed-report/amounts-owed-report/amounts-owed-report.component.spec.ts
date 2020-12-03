import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AmountsOwedReportComponent } from './amounts-owed-report.component';

describe('AmountsOwedReportComponent', () => {
	let component: AmountsOwedReportComponent;
	let fixture: ComponentFixture<AmountsOwedReportComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [AmountsOwedReportComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(AmountsOwedReportComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
