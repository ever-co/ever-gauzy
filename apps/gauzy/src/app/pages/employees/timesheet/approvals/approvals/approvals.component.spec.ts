import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ApprovalsComponent } from './approvals.component';

describe('ApprovalsComponent', () => {
	let component: ApprovalsComponent;
	let fixture: ComponentFixture<ApprovalsComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ApprovalsComponent],
			teardown: { destroyAfterEach: false }
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
