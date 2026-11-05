import { Subject } from 'rxjs';
import { EditEmployeeProjectsComponent, IEmployeeProjectRow } from './edit-employee-projects.component';

/**
 * Removing the employee from a project: the remove dialog asks first, only a confirmed removal reaches the
 * server, and the table reloads after it, whatever the server answered.
 */
describe('EditEmployeeProjectsComponent remove from project', () => {
	const ROW = { id: 'project-1', name: 'Design System' } as IEmployeeProjectRow;
	const EMPLOYEE = { id: 'employee-1', user: { firstName: 'Ann', lastName: 'Brown' } };
	const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1' };

	/** The tab with its services faked; `answer` is what the remove dialog closes with. */
	const tabWith = (answer: unknown, updateByEmployee = jest.fn(async () => true)) => {
		const component = Object.create(EditEmployeeProjectsComponent.prototype) as EditEmployeeProjectsComponent &
			Record<string, any>;
		const dialogClose = new Subject<unknown>();
		const open = jest.fn(() => {
			// The dialog answers once the component is waiting on it.
			Promise.resolve().then(() => {
				dialogClose.next(answer);
				dialogClose.complete();
			});
			return { onClose: dialogClose.asObservable() };
		});
		component.organization = ORGANIZATION as any;
		component.selectedEmployee = EMPLOYEE as any;
		component.removeDialog = {} as any;
		component.removingId = null;
		component.saving = false;
		component.viewedProject = null;
		component['_dialogService'] = { open };
		component['_organizationProjectsService'] = { updateByEmployee };
		component['_toastrService'] = { success: jest.fn(), danger: jest.fn() };
		component['subject$'] = new Subject<boolean>();
		const reloads = jest.fn();
		component['subject$'].subscribe(reloads);
		return { component, open, updateByEmployee, reloads };
	};

	it('asks in the remove dialog, with the row as its context', async () => {
		const { component, open } = tabWith(false);

		await component.remove(ROW);

		expect(open).toHaveBeenCalledTimes(1);
		expect(open).toHaveBeenCalledWith(component.removeDialog, expect.objectContaining({ context: ROW }));
	});

	it('on Remove, takes the employee off that project only, says so and reloads the table', async () => {
		const { component, updateByEmployee, reloads } = tabWith(true);

		await component.remove(ROW);

		expect(updateByEmployee).toHaveBeenCalledWith({
			addedProjectIds: [],
			removedProjectIds: ['project-1'],
			member: EMPLOYEE,
			organizationId: 'org-1',
			tenantId: 'tenant-1'
		});
		expect(component['_toastrService'].success).toHaveBeenCalledWith('TOASTR.MESSAGE.EMPLOYEE_PROJECT_REMOVED');
		expect(reloads).toHaveBeenCalledTimes(1);
		expect(component.removingId).toBeNull();
		expect(component.saving).toBe(false);
	});

	it.each([
		['Cancel', false],
		['Esc or a click outside the dialog', undefined]
	])('on %s, removes nothing', async (_, answer) => {
		const { component, updateByEmployee, reloads } = tabWith(answer);

		await component.remove(ROW);

		expect(updateByEmployee).not.toHaveBeenCalled();
		expect(reloads).not.toHaveBeenCalled();
		expect(component.removingId).toBeNull();
	});

	it('when the server refuses, shows the error, frees the row and still reloads the table', async () => {
		const failing = jest.fn(async () => {
			throw new Error('400');
		});
		const { component, reloads } = tabWith(true, failing);

		await component.remove(ROW);

		expect(component['_toastrService'].danger).toHaveBeenCalledWith('TOASTR.MESSAGE.EMPLOYEE_EDIT_ERROR');
		expect(component['_toastrService'].success).not.toHaveBeenCalled();
		expect(component.removingId).toBeNull();
		expect(component.saving).toBe(false);
		expect(reloads).toHaveBeenCalledTimes(1);
	});

	it('closes the quick look of the project it removed the employee from', async () => {
		const { component } = tabWith(true);
		component.viewedProject = { id: 'project-1', name: 'Design System', initials: 'DS' };

		await component.remove(ROW);

		expect(component.viewedProject).toBeNull();
	});

	it('CONTROL: leaves the quick look of another project open', async () => {
		const { component } = tabWith(true);
		const other = { id: 'project-2', name: 'Cloud Infrastructure', initials: 'CI' };
		component.viewedProject = other;

		await component.remove(ROW);

		expect(component.viewedProject).toBe(other);
	});

	it('ignores a second remove while one is in progress', async () => {
		const { component, open, updateByEmployee } = tabWith(true);
		component.removingId = 'project-2';

		await component.remove(ROW);

		expect(open).not.toHaveBeenCalled();
		expect(updateByEmployee).not.toHaveBeenCalled();
	});
});
