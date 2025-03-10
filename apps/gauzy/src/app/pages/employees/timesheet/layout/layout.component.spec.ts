import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { TimesheetLayoutComponent } from './layout.component';

describe('TimesheetLayoutComponent', () => {
	let component: TimesheetLayoutComponent;
	let fixture: ComponentFixture<TimesheetLayoutComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [TimesheetLayoutComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(TimesheetLayoutComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
