import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskTableComponent } from './task-table.component';
describe('TaskTableComponent', () => {
	let component: TaskTableComponent;
	let fixture: ComponentFixture<TaskTableComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TaskTableComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(TaskTableComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
