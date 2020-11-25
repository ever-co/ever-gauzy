import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppsUrlsReportComponent } from './apps-urls-report.component';

describe('AppsUrlsReportComponent', () => {
	let component: AppsUrlsReportComponent;
	let fixture: ComponentFixture<AppsUrlsReportComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [AppsUrlsReportComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(AppsUrlsReportComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
