import { Subject } from 'rxjs';
import { EditEmployeeProjectsComponent, IEmployeeProjectRow } from './edit-employee-projects.component';

/**
 * Assigning the employee to projects: the dialog's checklist ticks projects (all the search shows at once,
 * too), and only the ticked ones reach the server; the dialog closes once the server took them.
 */
describe('EditEmployeeProjectsComponent assign to projects', () => {
	const EMPLOYEE = { id: 'employee-1' };
	const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1' };
	const row = (id: string, name: string, extra: Partial<IEmployeeProjectRow> = {}) =>
		({ id, name, ...extra }) as IEmployeeProjectRow;
	const AVAILABLE = [
		row('p-1', 'Cloud Infrastructure', { code: 'CLD' }),
		row('p-2', 'Design System', { client: 'Acme' }),
		row('p-3', 'Gauzy Web Site')
	];

	const tabWith = (updateByEmployee = jest.fn(async () => true)) => {
		const component = Object.create(EditEmployeeProjectsComponent.prototype) as EditEmployeeProjectsComponent &
			Record<string, any>;
		const dialogClosed = new Subject<void>();
		const dialogRef = {
			close: jest.fn(() => {
				dialogClosed.next();
				dialogClosed.complete();
			}),
			onClose: dialogClosed.asObservable()
		};
		const open = jest.fn(() => dialogRef);
		component.organization = ORGANIZATION as any;
		component.selectedEmployee = EMPLOYEE as any;
		component.availableRows = AVAILABLE;
		component.assignSearch = '';
		component.assignSelection = new Set();
		component.saving = false;
		component.assignDialog = {} as any;
		component['_assignRef'] = null;
		component['_dialogService'] = { open };
		component['_organizationProjectsService'] = { updateByEmployee };
		component['_toastrService'] = { success: jest.fn(), danger: jest.fn() };
		component['subject$'] = new Subject<boolean>();
		const reloads = jest.fn();
		component['subject$'].subscribe(reloads);
		return { component, open, dialogRef, updateByEmployee, reloads };
	};

	it('opens the dialog with nothing ticked and no search, once', () => {
		const { component, open } = tabWith();
		component.assignSearch = 'old';
		component.assignSelection = new Set(['p-1']);

		component.openAssign();
		component.openAssign();

		expect(open).toHaveBeenCalledTimes(1);
		expect(component.assignSearch).toBe('');
		expect(component.assignSelection.size).toBe(0);
	});

	it('searches by name, key or client', () => {
		const { component } = tabWith();

		component.assignSearch = 'cld';
		expect(component.assignOptions.map((r) => r.id)).toEqual(['p-1']);
		component.assignSearch = 'acme';
		expect(component.assignOptions.map((r) => r.id)).toEqual(['p-2']);
		component.assignSearch = 'web';
		expect(component.assignOptions.map((r) => r.id)).toEqual(['p-3']);
	});

	it('ticks and unticks a project', () => {
		const { component } = tabWith();

		component.toggleOption('p-2');
		expect([...component.assignSelection]).toEqual(['p-2']);
		component.toggleOption('p-2');
		expect(component.assignSelection.size).toBe(0);
	});

	it('Select all ticks what the search shows, keeping earlier ticks; Deselect all unticks only those', () => {
		const { component } = tabWith();
		component.toggleOption('p-3');
		component.assignSearch = 'design';

		component.toggleAllOptions();
		expect(component.allOptionsSelected).toBe(true);
		expect([...component.assignSelection].sort()).toEqual(['p-2', 'p-3']);

		component.toggleAllOptions();
		expect([...component.assignSelection]).toEqual(['p-3']);
	});

	it('assigns the ticked projects, says so, reloads the table and closes the dialog', async () => {
		const { component, dialogRef, updateByEmployee, reloads } = tabWith();
		component.openAssign();
		component.toggleOption('p-1');
		component.toggleOption('p-3');

		await component.assignSelected();

		expect(updateByEmployee).toHaveBeenCalledWith({
			addedProjectIds: ['p-1', 'p-3'],
			removedProjectIds: [],
			member: EMPLOYEE,
			organizationId: 'org-1',
			tenantId: 'tenant-1'
		});
		expect(component['_toastrService'].success).toHaveBeenCalledWith('TOASTR.MESSAGE.EMPLOYEE_PROJECT_ADDED');
		expect(reloads).toHaveBeenCalledTimes(1);
		expect(dialogRef.close).toHaveBeenCalledTimes(1);
		expect(component['_assignRef']).toBeNull();
	});

	it('with nothing ticked, sends nothing', async () => {
		const { component, updateByEmployee } = tabWith();
		component.openAssign();

		await component.assignSelected();

		expect(updateByEmployee).not.toHaveBeenCalled();
	});

	it('when the server refuses, shows the error and keeps the dialog open with the ticks', async () => {
		const { component, dialogRef } = tabWith(
			jest.fn(async () => {
				throw new Error('400');
			})
		);
		component.openAssign();
		component.toggleOption('p-2');

		await component.assignSelected();

		expect(component['_toastrService'].danger).toHaveBeenCalledWith('TOASTR.MESSAGE.EMPLOYEE_EDIT_ERROR');
		expect(dialogRef.close).not.toHaveBeenCalled();
		expect([...component.assignSelection]).toEqual(['p-2']);
		expect(component.saving).toBe(false);
	});

	it('does not close while saving', () => {
		const { component, dialogRef } = tabWith();
		component.openAssign();
		component.saving = true;

		component.closeAssign();

		expect(dialogRef.close).not.toHaveBeenCalled();
	});
});
