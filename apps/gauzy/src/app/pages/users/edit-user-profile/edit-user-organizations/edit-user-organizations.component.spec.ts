import { of, Subject, throwError } from 'rxjs';
import { EditUserOrganizationsComponent } from './edit-user-organizations.component';

/**
 * The user page's Organizations tab: "Add to organization" opens a checklist of the signed-in user's organizations
 * the user is not in yet, read afresh through memberships; Add joins the ticked ones for the user the dialog was
 * opened for, says so once and reloads.
 */
describe('EditUserOrganizationsComponent add dialog', () => {
	const org = (id: string, name: string, officialName?: string) => ({ id, name, officialName }) as any;
	const ALL = [org('o-3', 'Gauzy Labs'), org('o-1', 'Ever Co', 'Ever Co. LTD'), org('o-2', 'Acme')];
	/** Lets the pending API answers land. */
	const settle = () => new Promise((resolve) => setTimeout(resolve));

	/** The tab for user-1, in Ever Co; `create` answers each join. */
	const tabWith = (create = jest.fn(() => of({}))) => {
		const component = Object.create(EditUserOrganizationsComponent.prototype) as EditUserOrganizationsComponent &
			Record<string, any>;
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
		Object.assign(component, { addDialog: {} }); // a readonly query, set by Angular in the app
		component.organizations = [ALL[1]];
		component.allOrganizations = ALL;
		component.selectedUserId = 'user-1';
		component.selectedUserName = 'Ann Brown';
		component.loading = false;
		component.addLoading = false;
		component.saving = false;
		component.addSearch = '';
		component.addSelection = new Set();
		component['_addRef'] = null;
		component['_addForUserId'] = null;
		component['dialogService'] = { open };
		const getAll = jest.fn(async () => ({
			items: ALL.map((organization) => ({ organization })),
			total: ALL.length
		}));
		component['userOrganizationsService'] = { create, getAll };
		component['store'] = { user: { tenantId: 'tenant-1' }, userId: 'admin-1' };
		component['toastrService'] = { success: jest.fn(), danger: jest.fn() };
		component.getTranslation = jest.fn((key: string) => key) as any;
		component.subject$ = new Subject<any>();
		const reloads = jest.fn();
		component.subject$.subscribe(reloads);
		return { component, open, refs, create, reloads };
	};

	it('offers the organizations the user is not in, by name', () => {
		const { component } = tabWith();

		expect(component.availableOrganizations.map((o) => o.id)).toEqual(['o-2', 'o-3']);
	});

	it('searches by name or official name', () => {
		const { component } = tabWith();
		component.allOrganizations = [...ALL, org('o-4', 'Studio', 'Gauzy Studio Ltd')];

		component.addSearch = 'gauzy';
		expect(component.addOptions.map((o) => o.id)).toEqual(['o-3', 'o-4']);
	});

	it('does not open before the user’s organizations are known', () => {
		const { component, open } = tabWith();
		component.loading = true;

		component.openAdd();

		expect(open).not.toHaveBeenCalled();
	});

	it('lists the signed-in user’s organizations, read through their memberships when it opens', async () => {
		const { component } = tabWith();
		component.allOrganizations = [];

		component.openAdd();
		expect(component.addLoading).toBe(true);
		await settle();

		expect(component['userOrganizationsService'].getAll).toHaveBeenCalledWith(['organization'], {
			userId: 'admin-1',
			tenantId: 'tenant-1'
		});
		expect(component.addLoading).toBe(false);
		expect(component.addOptions.map((o) => o.id)).toEqual(['o-2', 'o-3']);
	});

	it('says so when the organizations cannot be read, and stops loading', async () => {
		const { component } = tabWith();
		component['userOrganizationsService'].getAll = jest.fn(async () => {
			throw new Error('400');
		});

		component.openAdd();
		await settle();

		expect(component['toastrService'].danger).toHaveBeenCalled();
		expect(component.addLoading).toBe(false);
	});

	it('opens once, with nothing ticked and no search', () => {
		const { component, open } = tabWith();
		component.addSearch = 'old';
		component.addSelection = new Set(['o-2']);

		component.openAdd();
		component.openAdd();

		expect(open).toHaveBeenCalledTimes(1);
		expect(component.addSearch).toBe('');
		expect(component.addSelection.size).toBe(0);
	});

	it('Select all ticks what the search shows; Deselect all unticks them', () => {
		const { component } = tabWith();

		component.toggleAllOptions();
		expect([...component.addSelection].sort()).toEqual(['o-2', 'o-3']);
		component.toggleAllOptions();
		expect(component.addSelection.size).toBe(0);
	});

	it('joins each ticked organization for the dialog’s user, says so once, reloads and closes the dialog', async () => {
		const { component, refs, create, reloads } = tabWith();
		component.openAdd();
		await settle();
		component.toggleOption('o-2');
		component.toggleOption('o-3');

		await component.addSelected();

		expect(create.mock.calls.map(([input]) => input)).toEqual([
			{ userId: 'user-1', organizationId: 'o-2', tenantId: 'tenant-1', isActive: true, isDefault: true },
			{ userId: 'user-1', organizationId: 'o-3', tenantId: 'tenant-1', isActive: true, isDefault: true }
		]);
		expect(component['toastrService'].success).toHaveBeenCalledTimes(1);
		expect(reloads).toHaveBeenCalledTimes(1);
		expect(refs[0].close).toHaveBeenCalledTimes(1);
		expect(component.saving).toBe(false);
	});

	it('when a join fails, says so and keeps the dialog open', async () => {
		const { component, refs } = tabWith(jest.fn(() => throwError(() => new Error('409'))));
		component.openAdd();
		await settle();
		component.toggleOption('o-2');

		await component.addSelected();

		expect(component['toastrService'].danger).toHaveBeenCalled();
		expect(refs[0].close).not.toHaveBeenCalled();
		expect(component.saving).toBe(false);
	});

	it('joins nothing when the page moved to another user while the dialog was open', async () => {
		const { component, create } = tabWith();
		component.openAdd();
		await settle();
		component.toggleOption('o-2');
		component.selectedUserId = 'user-2';

		await component.addSelected();

		expect(create).not.toHaveBeenCalled();
	});

	it('does not close while saving, and closes when the tab is left', () => {
		const { component, refs } = tabWith();
		component.openAdd();
		component.saving = true;

		component.closeAdd();
		expect(refs[0].close).not.toHaveBeenCalled();

		component.ngOnDestroy();
		expect(refs[0].close).toHaveBeenCalledTimes(1);
	});

	it('lists a user in no organization yet as empty, and lets them be added', async () => {
		const { component, open } = tabWith();
		component.paramId = 'user-5';
		component.selectedUserId = undefined;
		component.loading = true;
		component['userOrganizationsService'].getAll = jest.fn(async (_relations: string[], where: any) =>
			where.userId === 'user-5'
				? { items: [], total: 0 }
				: { items: ALL.map((organization) => ({ organization })), total: 3 }
		);

		await component['loadOrganizations']();
		component.openAdd();

		expect(component['toastrService'].danger).not.toHaveBeenCalled();
		expect(component.organizations).toEqual([]);
		expect(component.selectedUserId).toBe('user-5');
		expect(open).toHaveBeenCalledTimes(1);
	});
});
