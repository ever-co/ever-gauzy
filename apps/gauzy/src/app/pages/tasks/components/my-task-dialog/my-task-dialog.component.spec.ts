import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyTaskDialogComponent } from './my-task-dialog.component';
import { TasksModule } from '../../tasks.module';
import { EmployeesService } from '@gauzy/ui-core/core';
describe('MyTaskDialogComponent', () => {
	let component: MyTaskDialogComponent;
	let fixture: ComponentFixture<MyTaskDialogComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule. EmployeesService is provided by the host feature modules in the app.
			imports: [TasksModule],
			providers: [EmployeesService],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(MyTaskDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
