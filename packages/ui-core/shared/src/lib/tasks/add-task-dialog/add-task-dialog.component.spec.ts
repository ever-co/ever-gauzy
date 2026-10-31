import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, Subject } from 'rxjs';
import {
	IOrganization,
	IOrganizationProject,
	IOrganizationProjectModule,
	IPagination,
	ITask,
	IUser,
	TaskStatusEnum
} from '@gauzy/contracts';
import { AddTaskDialogComponent } from './add-task-dialog.component';
import { AddTaskDialogModule } from './add-task-dialog.module';
import { AuthService, EmployeesService, OrganizationProjectModuleService, Store } from '@gauzy/ui-core/core';
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

		/** A project of the other client, as the project selector would report it. */
		const intranet = { id: 'project-2', name: 'Intranet', organizationContactId: GLOBEX } as IOrganizationProject;

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

		it("offers none of the previous list's projects while the picked client's list loads", () => {
			projectSelector().projects = [intranet];

			component.organizationContactControl.setValue(ACME);
			fixture.detectChanges();

			expect(projectSelector().projects).toEqual([]);
		});

		it('does not keep a project of another client picked in the project selector', () => {
			component.organizationContactControl.setValue(ACME);
			fixture.detectChanges();

			projectSelector().selectProject(intranet);

			expect(component.form.get('projectId').value).toBeNull();
			expect(component.form.get('project').value).toBeNull();
		});

		it('keeps a project of the picked client picked in the project selector', () => {
			const website = { id: 'project-1', name: 'Website', organizationContactId: ACME } as IOrganizationProject;
			component.organizationContactControl.setValue(ACME);
			fixture.detectChanges();

			projectSelector().selectProject(website);

			expect(component.form.get('projectId').value).toBe('project-1');
			expect(component.form.get('project').value).toEqual(website);
		});

		it("clears that project's modules with it, so none are saved on a task without a project", () => {
			selectProject(GLOBEX);
			component.availableModules = [{ id: 'module-1', name: 'Checkout' } as IOrganizationProjectModule];
			component.onModulesSelected(['module-1']);
			component.form.patchValue({ modules: ['module-1'] });

			component.organizationContactControl.setValue(ACME);

			expect(component.selectedModules).toEqual([]);
			expect(component.availableModules).toEqual([]);
			expect(component.form.get('modules').value).toEqual([]);
		});

		it('ignores modules that arrive for a project the client cleared meanwhile', async () => {
			const answer = new Subject<IPagination<IOrganizationProjectModule>>();
			jest.spyOn(TestBed.inject(OrganizationProjectModuleService), 'getAllModulesByProjectId').mockReturnValue(
				answer
			);
			component.organization = { id: 'organization-1' } as IOrganization;
			selectProject(GLOBEX); // asks for the project's modules

			component.organizationContactControl.setValue(ACME); // clears the project before they arrive
			answer.next({ items: [{ id: 'module-1', name: 'Checkout' } as IOrganizationProjectModule], total: 1 });
			await fixture.whenStable();

			expect(component.availableModules).toEqual([]);
		});

		it('names the client field with its label, for screen readers', () => {
			const input: HTMLInputElement = fixture.nativeElement.querySelector('ga-contact-selector input');

			expect(input.id).toBe('add-task-client');
			expect(fixture.nativeElement.querySelector('label[for="add-task-client"]')).toBeTruthy();
		});

		it('keeps a selected project of the picked client', () => {
			selectProject(ACME);
			component.onModulesSelected(['module-1']);

			component.organizationContactControl.setValue(ACME);

			expect(component.form.get('projectId').value).toBe('project-1');
			expect(component.selectedModules).toEqual(['module-1']);
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

	/*
	 * The modules a project offers load when the dialog's project changes. They used to load only because the
	 * project selector re-applied the URL's project after its first list; it no longer does that over a project
	 * the form already has, so the dialog must load them for its own starting project.
	 */
	describe("the starting project's modules", () => {
		const checkout = { id: 'module-1', name: 'Checkout' } as IOrganizationProjectModule;
		const website = { id: 'project-1', name: 'Website' } as IOrganizationProject;
		let store: Store;

		beforeEach(() => {
			jest.spyOn(TestBed.inject(OrganizationProjectModuleService), 'getAllModulesByProjectId').mockReturnValue(
				of({ items: [checkout], total: 1 })
			);
			store = TestBed.inject(Store);
			store.user = { id: 'user-1', tenantId: 'tenant-1' } as IUser;
			store.selectedOrganization = { id: 'organization-1', tenantId: 'tenant-1' } as IOrganization;
		});

		afterEach(() => {
			store.selectedProject = null;
			store.selectedOrganization = null;
		});

		const open = async (task?: ITask) => {
			const dialog = TestBed.createComponent(AddTaskDialogComponent);
			dialog.componentInstance.task = task;
			dialog.detectChanges();
			await dialog.whenStable();
			return dialog.componentInstance;
		};

		it('keeps the modules of a task saved unchanged', async () => {
			const dialog = await open({
				id: 'task-1',
				title: 'Checkout flow',
				status: TaskStatusEnum.OPEN,
				project: website,
				modules: [checkout],
				members: [],
				teams: []
			} as ITask);

			expect(dialog.availableModules).toEqual([checkout]);

			dialog.onSave();

			expect(dialog.form.get('modules').value).toEqual([checkout]);
		});

		it("offers the page's selected project's modules to a new task", async () => {
			store.selectedProject = website;

			const dialog = await open();

			expect(dialog.form.get('projectId').value).toBe('project-1');
			expect(dialog.availableModules).toEqual([checkout]);
		});
	});
});
