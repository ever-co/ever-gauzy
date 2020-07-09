import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskSettingsComponent } from './task-settings.component';

describe('TaskSettingsComponent', () => {
	let component: TaskSettingsComponent;
	let fixture: ComponentFixture<TaskSettingsComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [TaskSettingsComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(TaskSettingsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
