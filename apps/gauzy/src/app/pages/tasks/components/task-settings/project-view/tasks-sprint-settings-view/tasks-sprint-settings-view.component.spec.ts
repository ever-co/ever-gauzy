import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TasksSprintSettingsViewComponent } from './tasks-sprint-settings-view.component';

describe('TasksSprintViewComponent', () => {
	let component: TasksSprintSettingsViewComponent;
	let fixture: ComponentFixture<TasksSprintSettingsViewComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [TasksSprintSettingsViewComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(TasksSprintSettingsViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
