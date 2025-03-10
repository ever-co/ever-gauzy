import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { TimesheetViewComponent } from './view.component';

describe('TimesheetViewComponent', () => {
	let component: TimesheetViewComponent;
	let fixture: ComponentFixture<TimesheetViewComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [TimesheetViewComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(TimesheetViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
