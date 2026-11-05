import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DurationFormatPipe } from '@gauzy/ui-core/shared';
import { ApprovalsComponent } from './approvals.component';
describe('ApprovalsComponent', () => {
	let component: ApprovalsComponent;
	let fixture: ComponentFixture<ApprovalsComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ApprovalsComponent],
			// The page's total and each row's time go through the shared `durationFormat` pipe (#11627), which
			// the app-wide test defaults leave out (jest.angular-defaults.ts imports no workspace module).
			imports: [DurationFormatPipe],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(ApprovalsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
