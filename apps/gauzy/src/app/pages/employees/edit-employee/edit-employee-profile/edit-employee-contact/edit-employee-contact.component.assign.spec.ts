import { Subject } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { EditEmployeeContactComponent, IEmployeeContactRow } from './edit-employee-contact.component';

const EMPLOYEE = { id: 'employee-1' };
const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1' };

/** `n` contacts named "Contact 01", "Contact 02", ... */
const contacts = (n: number, from = 1) =>
	Array.from({ length: n }, (_, i) => {
		const index = String(from + i).padStart(2, '0');
		return { id: `c-${index}`, name: `Contact ${index}` };
	});

/** The assignable endpoint over `all`: a name substring match, `take` per page, `skip` counted from 1. */
const serverOf = (all: { id: string; name: string }[]) =>
	jest.fn(async ({ name, take, skip }: any) => {
		const term = String(name || '').toLowerCase();
		const matching = all.filter((contact) => contact.name.toLowerCase().includes(term));
		return { items: matching.slice((skip - 1) * take, skip * take), total: matching.length };
	});

/** Lets every pending page land (the fakes answer at once). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The tab with its services faked; the assign dialog's pages come from `pagination` (the assignable endpoint). */
const tabWith = (
	{
		updateByEmployee = jest.fn(async () => true),
		pagination = serverOf([])
	}: { updateByEmployee?: jest.Mock; pagination?: jest.Mock } = {}
) => {
	const component = Object.create(EditEmployeeContactComponent.prototype) as EditEmployeeContactComponent &
		Record<string, any>;
	// Each open gives a dialog of its own, closed by its close() (as Cancel, Esc or the backdrop do).
	const refs: { close: jest.Mock; onClose: any }[] = [];
	const open = jest.fn(() => {
		const closed = new Subject<void>();
		const ref = {
			close: jest.fn(() => {
				closed.next();
				closed.complete();
			}),
			onClose: closed.asObservable()
		};
		refs.push(ref);
		return ref;
	});
	component.organization = ORGANIZATION as any;
	component.selectedEmployee = EMPLOYEE as any;
	component.rows = [];
	component.assignOptions = [];
	component.optionsLoading = false;
	component.optionsFailed = false;
	component.assignSearch = '';
	component.assignSelection = new Set();
	component.saving = false;
	Object.assign(component, { assignDialog: {} }); // a readonly query, set by Angular in the app
	component['_assignRef'] = null;
	component['_assignContext'] = null;
	component['_optionsPage'] = 0;
	component['_optionsTotal'] = 0;
	component['_optionsRequest'] = 0;
	component['_dialogService'] = { open };
	// The dialog reads the assignable endpoint; the contact-view one (`pagination`) must not be asked.
	const contactViewPagination = jest.fn();
	component['_organizationContactService'] = {
		updateByEmployee,
		getAssignable: pagination,
		pagination: contactViewPagination
	};
	component['_toastrService'] = { success: jest.fn(), danger: jest.fn() };
	component['subject$'] = new Subject<boolean>();
	const reloads = jest.fn();
	component['subject$'].subscribe(reloads);
	return { component, open, refs, updateByEmployee, pagination, contactViewPagination, reloads };
};

/**
 * Assigning the employee to contacts: the dialog's checklist ticks contacts (all it shows at once, too), and only
 * the ticked ones reach the server; the dialog closes once the server took them.
 */
describe('EditEmployeeContactComponent assign to contacts', () => {
	const row = (id: string, name: string) => ({ id, name }) as IEmployeeContactRow;

	it('opens the dialog with nothing ticked and no search, once', () => {
		const { component, open } = tabWith();
		component.assignSearch = 'old';
		component.assignSelection = new Set(['c-01']);

		component.openAssign();
		component.openAssign();

		expect(open).toHaveBeenCalledTimes(1);
		expect(component.assignSearch).toBe('');
		expect(component.assignSelection.size).toBe(0);
	});

	it('ticks and unticks a contact', () => {
		const { component } = tabWith();

		component.toggleOption('c-02');
		expect([...component.assignSelection]).toEqual(['c-02']);
		component.toggleOption('c-02');
		expect(component.assignSelection.size).toBe(0);
	});

	it('Select all ticks what the dialog shows, keeping earlier ticks; Deselect all unticks only those', () => {
		const { component } = tabWith();
		component.toggleOption('c-03');
		component.assignOptions = [row('c-01', 'Acme'), row('c-02', 'Globex')];

		component.toggleAllOptions();
		expect(component.allOptionsSelected).toBe(true);
		expect([...component.assignSelection].sort()).toEqual(['c-01', 'c-02', 'c-03']);

		component.toggleAllOptions();
		expect([...component.assignSelection]).toEqual(['c-03']);
	});

	it('assigns the ticked contacts, says so, reloads the table and closes the dialog', async () => {
		const { component, refs, updateByEmployee, reloads } = tabWith();
		component.openAssign();
		component.toggleOption('c-01');
		component.toggleOption('c-03');

		await component.assignSelected();

		expect(updateByEmployee).toHaveBeenCalledWith({
			addedEntityIds: ['c-01', 'c-03'],
			removedEntityIds: [],
			member: EMPLOYEE,
			organizationId: 'org-1',
			tenantId: 'tenant-1'
		});
		expect(component['_toastrService'].success).toHaveBeenCalledWith('TOASTR.MESSAGE.EMPLOYEE_CLIENT_ADDED');
		expect(reloads).toHaveBeenCalledTimes(1);
		expect(refs[0].close).toHaveBeenCalledTimes(1);
		expect(component['_assignRef']).toBeNull();
	});

	it('with nothing ticked, sends nothing', async () => {
		const { component, updateByEmployee } = tabWith();
		component.openAssign();

		await component.assignSelected();

		expect(updateByEmployee).not.toHaveBeenCalled();
	});

	it('when the server refuses, shows the error and keeps the dialog open with the ticks', async () => {
		const { component, refs } = tabWith({
			updateByEmployee: jest.fn(async () => {
				throw new Error('400');
			})
		});
		component.openAssign();
		component.toggleOption('c-02');

		await component.assignSelected();

		expect(component['_toastrService'].danger).toHaveBeenCalledWith('TOASTR.MESSAGE.EMPLOYEE_EDIT_ERROR');
		expect(refs[0].close).not.toHaveBeenCalled();
		expect([...component.assignSelection]).toEqual(['c-02']);
		expect(component.saving).toBe(false);
	});

	it('does not close while saving', () => {
		const { component, refs } = tabWith();
		component.openAssign();
		component.saving = true;

		component.closeAssign();

		expect(refs[0].close).not.toHaveBeenCalled();
	});

	it('a dialog dismissed during the save: the success closes that one, not one opened since, and keeps its ticks', async () => {
		let answer: () => void = () => undefined;
		const updateByEmployee = jest.fn(() => new Promise<boolean>((resolve) => (answer = () => resolve(true))));
		const { component, refs } = tabWith({ updateByEmployee });
		component.openAssign();
		component.toggleOption('c-01');

		const assigning = component.assignSelected();
		refs[0].close(); // Esc or a backdrop click while the request runs
		component.openAssign();
		component.toggleOption('c-02');
		answer();
		await assigning;

		expect(updateByEmployee).toHaveBeenCalledWith(expect.objectContaining({ addedEntityIds: ['c-01'] }));
		expect(refs).toHaveLength(2);
		expect(refs[1].close).not.toHaveBeenCalled();
		expect(component['_assignRef']).toBe(refs[1]);
		expect([...component.assignSelection]).toEqual(['c-02']);
	});

	it('assigns nothing when the tab switched employee while the dialog was open', async () => {
		const { component, updateByEmployee } = tabWith();
		component.openAssign();
		component.toggleOption('c-01');
		component.selectedEmployee = { id: 'employee-2' } as any;

		await component.assignSelected();

		expect(updateByEmployee).not.toHaveBeenCalled();
	});
});

/**
 * The assign dialog reads the organization's contacts a page at a time, when it opens and as its list scrolls,
 * searched by name on the server, never all of them at once.
 */
describe('EditEmployeeContactComponent assign dialog pages', () => {
	it('reads nothing until the dialog opens, then the first page of the assignable contacts', async () => {
		const pagination = serverOf(contacts(5));
		const { component, contactViewPagination } = tabWith({ pagination });
		expect(pagination).not.toHaveBeenCalled();

		component.openAssign();
		await settle();

		expect(pagination).toHaveBeenCalledTimes(1);
		expect(pagination).toHaveBeenCalledWith({ organizationId: 'org-1', tenantId: 'tenant-1', take: 30, skip: 1 });
		// Choosing a contact takes ORG_EMPLOYEES_EDIT, as assigning does: never the contact-view read.
		expect(contactViewPagination).not.toHaveBeenCalled();
		expect(component.assignOptions.map((row) => row.id)).toEqual(['c-01', 'c-02', 'c-03', 'c-04', 'c-05']);
		expect(component.hasMoreOptions).toBe(false);
	});

	it('leaves out the contacts the employee already has', async () => {
		const { component } = tabWith({ pagination: serverOf(contacts(4)) });
		component.rows = [{ id: 'c-02' } as IEmployeeContactRow, { id: 'c-04' } as IEmployeeContactRow];

		component.openAssign();
		await settle();

		expect(component.assignOptions.map((row) => row.id)).toEqual(['c-01', 'c-03']);
	});

	it('reads the next page when the list is scrolled near its end, and stops at the last one', async () => {
		const pagination = serverOf(contacts(45));
		const { component } = tabWith({ pagination });
		component.openAssign();
		await settle();
		expect(component.assignOptions).toHaveLength(30);
		expect(component.hasMoreOptions).toBe(true);

		component.onOptionsScroll({ target: { scrollTop: 560, clientHeight: 400, scrollHeight: 1000 } } as any);
		await settle();

		expect(pagination).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 2 }));
		expect(component.assignOptions).toHaveLength(45);
		expect(component.hasMoreOptions).toBe(false);
	});

	it('CONTROL: scrolling far from the end reads nothing more', async () => {
		const pagination = serverOf(contacts(45));
		const { component } = tabWith({ pagination });
		component.openAssign();
		await settle();

		component.onOptionsScroll({ target: { scrollTop: 100, clientHeight: 400, scrollHeight: 1000 } } as any);
		await settle();

		expect(pagination).toHaveBeenCalledTimes(1);
	});

	it('reads on past pages made of contacts the employee already has', async () => {
		const pagination = serverOf(contacts(70));
		const { component } = tabWith({ pagination });
		// The first page's 30 are all the employee's: it alone would show an empty list.
		component.rows = contacts(30).map((contact) => contact as IEmployeeContactRow);

		component.openAssign();
		await settle();

		// Page 2 brings a full page of new ones, so reading stops there.
		expect(pagination).toHaveBeenCalledTimes(2);
		expect(component.assignOptions.map((row) => row.id)[0]).toBe('c-31');
		expect(component.assignOptions).toHaveLength(30);
	});

	it('searches by name on the server, from the first page again', async () => {
		const all = [...contacts(3), { id: 'acme', name: 'Acme Corp' }];
		const pagination = serverOf(all);
		const { component } = tabWith({ pagination });
		component.openAssign();
		await settle();

		component.assignSearch = 'acme';
		await component.loadOptions(true);

		expect(pagination).toHaveBeenLastCalledWith({
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			name: 'acme',
			take: 30,
			skip: 1
		});
		expect(component.assignOptions.map((row) => row.id)).toEqual(['acme']);
	});

	it('drops the answer of an older search that lands after a newer one', async () => {
		const answers: Record<string, (page: any) => void> = {};
		const pagination = jest.fn(({ name }: any) => new Promise((resolve) => (answers[name || ''] = resolve)));
		const { component } = tabWith({ pagination });
		component.openAssign(); // asks for '' and waits

		component.assignSearch = 'globex';
		const newer = component.loadOptions(true);
		answers['globex']({ items: [{ id: 'globex', name: 'Globex' }], total: 1 });
		await newer;
		answers['']({ items: contacts(3), total: 3 });
		await settle();

		expect(component.assignOptions.map((row) => row.id)).toEqual(['globex']);
	});

	it('says when a page cannot be read, and reads it again on Retry', async () => {
		let fail = true;
		const server = serverOf(contacts(3));
		const pagination = jest.fn(async (query: any) => {
			if (fail) {
				throw new Error('500');
			}
			return server(query);
		});
		const { component } = tabWith({ pagination });
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		component.openAssign();
		await settle();
		expect(component.optionsFailed).toBe(true);
		expect(component.optionsLoading).toBe(false);

		fail = false;
		component.retryOptions();
		await settle();

		expect(component.optionsFailed).toBe(false);
		expect(pagination).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 1 }));
		expect(component.assignOptions).toHaveLength(3);
	});

	it('forgets a page still on its way when the dialog closes', async () => {
		let answer: (page: any) => void = () => undefined;
		const pagination = jest.fn(() => new Promise((resolve) => (answer = resolve)));
		const { component, refs } = tabWith({ pagination });
		component.openAssign();

		refs[0].close();
		answer({ items: contacts(3), total: 3 });
		await settle();

		expect(component.assignOptions).toEqual([]);
	});
});

/**
 * The table reads the details of the employee's own contacts only, never every contact of the organization.
 */
describe('EditEmployeeContactComponent table', () => {
	const tableWith = (canViewContacts: boolean, pagination = jest.fn()) => {
		const component = Object.create(EditEmployeeContactComponent.prototype) as EditEmployeeContactComponent &
			Record<string, any>;
		component.organization = ORGANIZATION as any;
		component.selectedEmployee = EMPLOYEE as any;
		component['_loadId'] = 0;
		component['_store'] = { hasPermission: jest.fn(() => canViewContacts) };
		component['_errorHandlingService'] = { handleError: jest.fn() };
		component['_organizationContactService'] = {
			getAllByEmployee: jest.fn(async () => [
				{ id: 'c-02', name: 'Globex' },
				{ id: 'c-01', name: 'Acme Corp' }
			]),
			pagination
		};
		return component;
	};

	it('reads the details of the employee’s contacts only, and fills the rows with them', async () => {
		const pagination = jest.fn(async () => ({
			items: [
				{ id: 'c-01', name: 'Acme Corp', contactType: 'CLIENT', projects: [{ name: 'Website' }] },
				{ id: 'c-02', name: 'Globex', primaryEmail: 'hi@globex.io' }
			],
			total: 2
		}));
		const component = tableWith(true, pagination);

		await component['loadContacts']();

		expect(pagination).toHaveBeenCalledTimes(1);
		expect(pagination).toHaveBeenCalledWith({
			where: { organizationId: 'org-1', tenantId: 'tenant-1', members: ['employee-1'] },
			relations: ['projects'],
			order: { name: 'ASC', id: 'ASC' },
			take: 100,
			skip: 1
		});
		expect(component.rows.map((row) => row.id)).toEqual(['c-01', 'c-02']);
		expect(component.rows[0].type?.tone).toBe('info');
		expect(component.rows[0].projectNames).toEqual(['Website']);
		expect(component.rows[1].email).toBe('hi@globex.io');
		expect(component.loading).toBe(false);
	});

	it('without the right to view contacts, shows the names it has and asks for nothing more', async () => {
		const pagination = jest.fn();
		const component = tableWith(false, pagination);

		await component['loadContacts']();

		expect(pagination).not.toHaveBeenCalled();
		expect(component.rows.map((row) => row.name)).toEqual(['Acme Corp', 'Globex']);
	});
});


/**
 * A contact as a row: its type lozenge, live projects and picture.
 */
describe('EditEmployeeContactComponent rows', () => {
	const rowOf = (contact: Record<string, any>): IEmployeeContactRow => {
		const component = Object.create(EditEmployeeContactComponent.prototype) as EditEmployeeContactComponent &
			Record<string, any>;
		return component['toRow']({ id: 'c-1', name: 'Acme Corp', ...contact });
	};

	it.each([
		['CLIENT', 'CLIENT', 'info'],
		['CUSTOMER', 'CUSTOMER', 'success'],
		['LEAD', 'LEAD', 'warning']
	])('labels a %s with its type', (contactType, key, tone) => {
		expect(rowOf({ contactType }).type).toEqual({ key: `EMPLOYEES_PAGE.EDIT_EMPLOYEE.CONTACTS_TAB.TYPE.${key}`, tone });
	});

	it('has no type lozenge without a type', () => {
		expect(rowOf({}).type).toBeNull();
	});

	it('lists the live projects by name, archived ones left out', () => {
		const row = rowOf({
			projects: [
				{ name: 'Website' },
				{ name: 'Old Portal', isArchived: true },
				{ name: 'Mobile App' }
			]
		});

		expect(row.projectNames).toEqual(['Mobile App', 'Website']);
		expect(row.projectList).toBe('Mobile App, Website');
	});

	it('uses the picture, else the image asset, else initials', () => {
		expect(rowOf({ imageUrl: 'a.png' }).imageUrl).toBe('a.png');
		expect(rowOf({ image: { fullUrl: 'b.png' } }).imageUrl).toBe('b.png');
		const plain = rowOf({});
		expect(plain.imageUrl).toBeUndefined();
		expect(plain.initials).toBe('AC');
	});
});

/**
 * Choosing a contact (`GET /organization-contact/assignable`) and saving the change both take ORG_EMPLOYEES_EDIT, so
 * the tab offers assign and remove only to its holders; others still see the employee's contacts.
 */
describe('EditEmployeeContactComponent assign and remove rights', () => {
	const componentHolding = (permissions: PermissionsEnum[]) => {
		const component = Object.create(EditEmployeeContactComponent.prototype) as EditEmployeeContactComponent &
			Record<string, any>;
		component['_store'] = { hasPermission: jest.fn((permission: PermissionsEnum) => permissions.includes(permission)) };
		return component;
	};

	it('offers them to an employee editor', () => {
		expect(componentHolding([PermissionsEnum.ORG_EMPLOYEES_EDIT]).canChangeContacts).toBe(true);
	});

	it('does not offer them to someone who may only view contacts or edit their profile', () => {
		const viewer = componentHolding([PermissionsEnum.ORG_CONTACT_VIEW, PermissionsEnum.PROFILE_EDIT]);

		expect(viewer.canChangeContacts).toBe(false);
	});
});
