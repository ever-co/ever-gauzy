import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimerTrackerChangeDialogComponent } from './timer-tracker-change-dialog.component';

describe('TimerTrackerChangeDialogComponent', () => {
	let component: TimerTrackerChangeDialogComponent;
	let fixture: ComponentFixture<TimerTrackerChangeDialogComponent>;

	beforeEach(() => {
		TestBed.configureTestingModule({
			declarations: [TimerTrackerChangeDialogComponent]
		});
		fixture = TestBed.createComponent(TimerTrackerChangeDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
