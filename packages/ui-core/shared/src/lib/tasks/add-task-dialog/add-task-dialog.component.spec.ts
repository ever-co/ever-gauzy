import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AddTaskDialogComponent } from './add-task-dialog.component';
import { AddTaskDialogModule } from './add-task-dialog.module';
import { AuthService, EmployeesService } from '@gauzy/ui-core/core';
import { ProjectSelectorComponent } from '../../selectors/project/project/project.component';
import { ContactSelectorComponent } from '../../contact-selector/contact-selector.component';
describe('AddTaskDialogComponent', () => {
	let component: AddTaskDialogComponent;
	let fixture: ComponentFixture<AddTaskDialogComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule. EmployeesService and AuthService are provided by the host feature
			// modules in the app.
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

	describe('optional client', () => {
		const ACME = 'client-acme';
		const GLOBEX = 'client-globex';

		const projectSelector = (): ProjectSelectorComponent =>
			fixture.debugElement.query(By.directive(ProjectSelectorComponent)).componentInstance;

		const selectProject = (organizationContactId: string | null) => {
			component.form.patchValue({
				project: { id: 'project-1', name: 'Website', organizationContactId },
				projectId: 'project-1'
			});
		};

		it('offers a client selector, empty by default', () => {
			expect(fixture.debugElement.query(By.directive(ContactSelectorComponent))).toBeTruthy();
			expect(component.organizationContactControl.value).toBeNull();
		});

		it('leaves the project list unfiltered while no client is picked', () => {
			expect(projectSelector().organizationContactId).toBeFalsy();
		});

		it('narrows the project list to the picked client', () => {
			component.organizationContactControl.setValue(ACME);
			fixture.detectChanges();

			expect(projectSelector().organizationContactId).toBe(ACME);
		});

		it('clears a selected project that belongs to another client', () => {
			selectProject(GLOBEX);

			component.organizationContactControl.setValue(ACME);

			expect(component.form.get('projectId').value).toBeNull();
			expect(component.form.get('project').value).toBeNull();
		});

		it('keeps a selected project of the picked client', () => {
			selectProject(ACME);

			component.organizationContactControl.setValue(ACME);

			expect(component.form.get('projectId').value).toBe('project-1');
		});

		it('keeps the selected project when the client is cleared again', () => {
			selectProject(ACME);
			component.organizationContactControl.setValue(ACME);
			fixture.detectChanges();
			expect(projectSelector().organizationContactId).toBe(ACME);

			component.organizationContactControl.setValue(null);
			fixture.detectChanges();

			expect(component.form.get('projectId').value).toBe('project-1');
			expect(projectSelector().organizationContactId).toBeFalsy();
		});

		it('never sends the client with the task', () => {
			component.organizationContactControl.setValue(ACME);

			expect(component.form.value).not.toHaveProperty('organizationContactId');
			expect(component.form.value).not.toHaveProperty('organizationContact');
		});
	});
});
