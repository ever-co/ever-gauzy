import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ApprovalsComponent } from './approvals.component';

describe('ApprovalsComponent', () => {
	let component: ApprovalsComponent;
	let fixture: ComponentFixture<ApprovalsComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ApprovalsComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ApprovalsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
