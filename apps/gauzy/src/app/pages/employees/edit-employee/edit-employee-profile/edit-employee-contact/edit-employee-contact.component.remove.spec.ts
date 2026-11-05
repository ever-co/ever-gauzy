import { Subject } from 'rxjs';
import { EditEmployeeContactComponent, IEmployeeContactRow } from './edit-employee-contact.component';

/**
 * Removing the employee from a contact: the remove dialog asks first, only a confirmed removal reaches the
 * server, and the table reloads after it, whatever the server answered.
 */
describe('EditEmployeeContactComponent remove from contact', () => {
	const ROW = { id: 'contact-1', name: 'Acme Corp' } as IEmployeeContactRow;
	const EMPLOYEE = { id: 'employee-1', user: { firstName: 'Ann', lastName: 'Brown' } };
	const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1' };

	/** The tab with its services faked; `answer` is what the remove dialog closes with. */
	const tabWith = (answer: unknown, updateByEmployee = jest.fn(async () => true)) => {
		const component = Object.create(EditEmployeeContactComponent.prototype) as EditEmployeeContactComponent &
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
		Object.assign(component, { removeDialog: {} }); // a readonly query, set by Angular in the app
		component.removingId = null;
		component.loading = false;
		component.saving = false;
		component['_dialogService'] = { open };
		component['_organizationContactService'] = { updateByEmployee };
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

	it('on Remove, takes the employee off that contact only, says so and reloads the table', async () => {
		const { component, updateByEmployee, reloads } = tabWith(true);

		await component.remove(ROW);

		expect(updateByEmployee).toHaveBeenCalledWith({
			addedEntityIds: [],
			removedEntityIds: ['contact-1'],
			member: EMPLOYEE,
			organizationId: 'org-1',
			tenantId: 'tenant-1'
		});
		expect(component['_toastrService'].success).toHaveBeenCalledWith('TOASTR.MESSAGE.EMPLOYEE_CLIENT_REMOVED');
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

	it('ignores a second remove while one is in progress', async () => {
		const { component, open, updateByEmployee } = tabWith(true);
		component.removingId = 'contact-2';

		await component.remove(ROW);

		expect(open).not.toHaveBeenCalled();
		expect(updateByEmployee).not.toHaveBeenCalled();
	});

	it('refuses while the rows are loading: they may still be the previous employee’s', async () => {
		const { component, open, updateByEmployee } = tabWith(true);
		component.loading = true;

		await component.remove(ROW);

		expect(open).not.toHaveBeenCalled();
		expect(updateByEmployee).not.toHaveBeenCalled();
	});

	it('removes nothing when the tab switched employee while the dialog was open', async () => {
		const { component, updateByEmployee } = tabWith(true);

		const removing = component.remove(ROW);
		// Another employee's Contacts route, before Remove is clicked in the dialog.
		component.selectedEmployee = { id: 'employee-2' } as any;
		await removing;

		expect(updateByEmployee).not.toHaveBeenCalled();
	});

	it('leaving the tab closes an open remove dialog as cancelled: remove() ends and removes nothing', async () => {
		const { component, updateByEmployee } = tabWith(true);
		// A dialog that stays open until something closes it.
		const closed = new Subject<unknown>();
		const close = jest.fn((value: unknown) => {
			closed.next(value);
			closed.complete();
		});
		component['_dialogService'] = { open: jest.fn(() => ({ close, onClose: closed.asObservable() })) };

		const removing = component.remove(ROW);
		component.ngOnDestroy();
		await removing;

		expect(close).toHaveBeenCalledWith(false);
		expect(updateByEmployee).not.toHaveBeenCalled();
	});

	it('CONTROL: still removes when the store re-emits the same employee while the dialog is open', async () => {
		const { component, updateByEmployee } = tabWith(true);

		const removing = component.remove(ROW);
		component.selectedEmployee = { ...EMPLOYEE } as any; // the store re-emits the same employee
		await removing;

		expect(updateByEmployee).toHaveBeenCalledWith(expect.objectContaining({ member: EMPLOYEE }));
	});
});

/**
 * Switching employee drops what belonged to the previous one: its rows, and any dialog still open for it.
 */
describe('EditEmployeeContactComponent switching employee', () => {
	const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1' } as any;

	const tabShowing = (employeeId: string) => {
		const component = Object.create(EditEmployeeContactComponent.prototype) as EditEmployeeContactComponent &
			Record<string, any>;
		component.organization = ORGANIZATION;
		component.selectedEmployee = { id: employeeId } as any;
		component.rows = [{ id: 'contact-1', name: 'Acme Corp' } as IEmployeeContactRow];
		component.assignOptions = [{ id: 'contact-2', name: 'Globex' } as IEmployeeContactRow];
		component.searchTerm = 'acme';
		component['_removeRef'] = { close: jest.fn() };
		component['_assignRef'] = { close: jest.fn() };
		return component;
	};

	it('clears the previous employee’s rows and search, and closes their dialogs', () => {
		const component = tabShowing('employee-1');
		const removeRef = component['_removeRef'];
		const assignRef = component['_assignRef'];

		component.selectContext(ORGANIZATION, { id: 'employee-2' } as any);

		expect(component.selectedEmployee.id).toBe('employee-2');
		expect(component.rows).toEqual([]);
		expect(component.assignOptions).toEqual([]);
		expect(component.searchTerm).toBe('');
		expect(removeRef.close).toHaveBeenCalledWith(false);
		expect(assignRef.close).toHaveBeenCalled();
	});

	it('leaving the tab closes both dialogs, the remove one as cancelled', () => {
		const component = tabShowing('employee-1');

		component.ngOnDestroy();

		expect(component['_removeRef'].close).toHaveBeenCalledWith(false);
		expect(component['_assignRef'].close).toHaveBeenCalled();
	});

	it('CONTROL: the same employee again keeps the rows and the dialogs', () => {
		const component = tabShowing('employee-1');

		component.selectContext(ORGANIZATION, { id: 'employee-1' } as any);

		expect(component.rows.length).toBe(1);
		expect(component.searchTerm).toBe('acme');
		expect(component['_removeRef'].close).not.toHaveBeenCalled();
		expect(component['_assignRef'].close).not.toHaveBeenCalled();
	});
});
