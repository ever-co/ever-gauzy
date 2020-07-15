import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TasksLayoutsComponent } from './tasks-layouts.component';

describe('TasksLayoutsComponent', () => {
	let component: TasksLayoutsComponent;
	let fixture: ComponentFixture<TasksLayoutsComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [TasksLayoutsComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(TasksLayoutsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
