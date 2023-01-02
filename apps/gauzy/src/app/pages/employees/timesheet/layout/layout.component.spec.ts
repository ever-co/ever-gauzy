import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TimesheetLayoutComponent } from './layout.component';

describe('TimesheetLayoutComponent', () => {
	let component: TimesheetLayoutComponent;
	let fixture: ComponentFixture<TimesheetLayoutComponent>;

	beforeEach(async(() => {
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
