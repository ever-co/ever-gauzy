import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddTaskDialogComponent } from './add-task-dialog.component';
import { AddTaskDialogModule } from './add-task-dialog.module';
import { AuthService, EmployeesService } from '@gauzy/ui-core/core';
describe('AddTaskDialogComponent', () => {
	let component: AddTaskDialogComponent;
	let fixture: ComponentFixture<AddTaskDialogComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule. EmployeesService and AuthService are provided by the host feature modules in the app.
			imports: [AddTaskDialogModule],
			providers: [EmployeesService, AuthService],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(AddTaskDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
