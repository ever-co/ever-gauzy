import { of, Subject, throwError } from 'rxjs';
import { RolesEnum } from '@gauzy/contracts';
import { EditUserOrganizationsComponent } from './edit-user-organizations.component';

/**
 * The user page's Organizations tab: "Add to organization" opens a checklist of the organizations the signed-in user
 * may add the user to (a tenant admin: every organization of the tenant; anyone else: the one they are signed in to)
 * that the user is not active in, read afresh when it opens. Add joins the ticked ones for the user the dialog was
 * opened for (reactivating an inactive membership rather than making a second), says so once and reloads.
 */
describe('EditUserOrganizationsComponent add dialog', () => {
	const org = (id: string, name: string, officialName?: string) => ({ id, name, officialName }) as any;
	const ALL = [org('o-3', 'Gauzy Labs'), org('o-1', 'Ever Co', 'Ever Co. LTD'), org('o-2', 'Acme')];
	/** Lets the pending API answers land. */
	const settle = () => new Promise((resolve) => setTimeout(resolve));

	/** The tab for user-1, in Ever Co, opened by a tenant admin; `create` answers each join. */
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
		component.inactiveMemberships = new Map();
		component.paramId = 'user-1';
		component.selectedUserId = 'user-1';
		component.selectedUserName = 'Ann Brown';
		component.loading = false;
		component.addLoading = false;
		component.saving = false;
		component.addSearch = '';
		component.addSelection = new Set();
		component['_addRef'] = null;
		component['_addForUserId'] = null;
		component['_loadSeq'] = 0;
		component['dialogService'] = { open };
		const getAll = jest.fn(async () => ({
			items: ALL.map((organization) => ({ organization })),
			total: ALL.length
		}));
		const setUserAsActive = jest.fn(async () => ({}));
		component['userOrganizationsService'] = { create, getAll, setUserAsActive };
		component['store'] = {
			user: { tenantId: 'tenant-1', role: { name: RolesEnum.ADMIN } },
			userId: 'admin-1',
			selectedOrganization: ALL[2]
		};
		component['toastrService'] = { success: jest.fn(), danger: jest.fn() };
		component.getTranslation = jest.fn((key: string) => key) as any;
		component.subject$ = new Subject<any>();
		const reloads = jest.fn();
		component.subject$.subscribe(reloads);
		return { component, open, refs, create, getAll, setUserAsActive, reloads };
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

	it('does not open while the organizations shown are another user’s', () => {
		const { component, open } = tabWith();
		component.paramId = 'user-2'; // the page moved on; user-2's load has not landed yet

		component.openAdd();

		expect(open).not.toHaveBeenCalled();
	});

	it('for a tenant admin, offers every organization of the tenant, read through its memberships when it opens', async () => {
		const { component, getAll } = tabWith();
		component.allOrganizations = [];

		component.openAdd();
		expect(component.addLoading).toBe(true);
		await settle();

		expect(getAll).toHaveBeenCalledWith(['organization'], { tenantId: 'tenant-1' });
		expect(component.addLoading).toBe(false);
		expect(component.addOptions.map((o) => o.id)).toEqual(['o-2', 'o-3']);
	});

	it('for anyone else, offers only the organization they are signed in to, as the server allows', async () => {
		const { component, getAll } = tabWith();
		component['store'].user.role = { name: RolesEnum.MANAGER };
		component.allOrganizations = [];

		component.openAdd();
		await settle();

		expect(getAll).not.toHaveBeenCalled();
		expect(component.addOptions.map((o) => o.id)).toEqual(['o-2']);
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

	it('does not reopen while a save runs, so the ticks a failed save leaves stay for the retry', () => {
		const { component, open } = tabWith();
		component.saving = true;
		component.addSelection = new Set(['o-3']);

		component.openAdd();

		expect(open).not.toHaveBeenCalled();
		expect([...component.addSelection]).toEqual(['o-3']);
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

	it('reactivates an inactive membership instead of making a second one', async () => {
		const { component, create, setUserAsActive } = tabWith();
		component.inactiveMemberships = new Map([['o-2', 'membership-9']]);
		component.openAdd();
		await settle();
		component.toggleOption('o-2');
		component.toggleOption('o-3');

		await component.addSelected();

		expect(setUserAsActive).toHaveBeenCalledWith('membership-9');
		expect(create.mock.calls.map(([input]) => input.organizationId)).toEqual(['o-3']);
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

	it('after a partly failed add, a retry sends only what is still to add', async () => {
		const create = jest
			.fn()
			.mockReturnValueOnce(of({}))
			.mockReturnValueOnce(throwError(() => new Error('500')))
			.mockReturnValue(of({}));
		const { component } = tabWith(create);
		component.openAdd();
		await settle();
		component.toggleOption('o-2');
		component.toggleOption('o-3');

		await component.addSelected();
		expect([...component.addSelection]).toEqual(['o-3']);
		await component.addSelected();

		expect(create.mock.calls.map(([input]) => input.organizationId)).toEqual(['o-2', 'o-3', 'o-3']);
	});

	it('joins nothing when the page moved to another user while the dialog was open', async () => {
		const { component, create } = tabWith();
		component.openAdd();
		await settle();
		component.toggleOption('o-2');
		component.paramId = 'user-2';

		await component.addSelected();

		expect(create).not.toHaveBeenCalled();
	});

	it.each([
		['before the next user’s memberships land', new Map<string, string>()],
		['after the next user’s memberships land', new Map([['o-3', 'membership-of-user-2']])]
	])(
		'keeps reactivating and naming the dialog’s user when the page moves to another user mid-save (%s)',
		async (_moment, nextUsersInactive) => {
			const firstJoin = new Subject<any>();
			const create = jest.fn().mockReturnValueOnce(firstJoin).mockReturnValue(of({}));
			const { component, create: joins, setUserAsActive } = tabWith(create);
			component.inactiveMemberships = new Map([['o-3', 'membership-of-user-1']]);
			component.openAdd();
			await settle();
			component.toggleOption('o-2');
			component.toggleOption('o-3');

			const saving = component.addSelected();
			// What the route change, then the next user's load, does while the first join is on its way.
			component.paramId = 'user-2';
			component['_loadSeq']++;
			component.selectedUserId = null;
			component.organizations = [];
			component.inactiveMemberships = nextUsersInactive;
			component.selectedUserName = 'Bo Lee';
			firstJoin.next({});
			firstJoin.complete();
			await saving;

			expect(setUserAsActive.mock.calls).toEqual([['membership-of-user-1']]);
			expect(joins.mock.calls.map(([input]) => [input.userId, input.organizationId])).toEqual([['user-1', 'o-2']]);
			expect(component.getTranslation).toHaveBeenCalledWith('NOTES.ORGANIZATIONS.ADD_NEW_USER_TO_ORGANIZATION', {
				username: 'Ann Brown',
				orgname: 'ORGANIZATIONS_PAGE.EDIT.ADDED_TO_ORGANIZATION'
			});
		}
	);

	it('does not close while saving, and closes when the tab is left', () => {
		const { component, refs } = tabWith();
		component.openAdd();
		component.saving = true;

		component.closeAdd();
		expect(refs[0].close).not.toHaveBeenCalled();

		component.ngOnDestroy();
		expect(refs[0].close).toHaveBeenCalledTimes(1);
	});
});

/**
 * The tab's list: the user's active memberships, read for the page's current user only, with their name read from
 * the user whether or not they are in any organization.
 */
describe('EditUserOrganizationsComponent list', () => {
	const org = (id: string, name: string) => ({ id, name }) as any;

	const tabFor = (memberships: Record<string, any[]>, user: any = { firstName: 'Bo', lastName: 'Lee' }) => {
		const component = Object.create(EditUserOrganizationsComponent.prototype) as EditUserOrganizationsComponent &
			Record<string, any>;
		component.organizations = [];
		component.allOrganizations = [];
		component.inactiveMemberships = new Map();
		component.addSelection = new Set();
		component.selectedUserId = null;
		component.loading = true;
		component['_loadSeq'] = 0;
		component['store'] = { user: { tenantId: 'tenant-1' } };
		component['toastrService'] = { danger: jest.fn() };
		const getAll = jest.fn(async (_relations: string[], where: { userId: string }) => {
			const items = memberships[where.userId] ?? [];
			return { items, total: items.length };
		});
		component['userOrganizationsService'] = { getAll };
		component['usersService'] = { getUserById: jest.fn(async () => user) };
		return { component, getAll };
	};

	it('lists the organizations the user is active in, and keeps the inactive ones to reactivate', async () => {
		const { component, getAll } = tabFor({
			'user-1': [
				{
					id: 'm-1',
					userId: 'user-1',
					organizationId: 'o-1',
					isActive: true,
					organization: org('o-1', 'Ever Co')
				},
				{
					id: 'm-2',
					userId: 'user-1',
					organizationId: 'o-2',
					isActive: false,
					organization: org('o-2', 'Acme')
				}
			]
		});
		component.paramId = 'user-1';

		await component['loadOrganizations']();

		expect(getAll).toHaveBeenCalledWith(['organization'], { userId: 'user-1', tenantId: 'tenant-1' });
		expect(component.organizations.map((o) => o.id)).toEqual(['o-1']);
		expect([...component.inactiveMemberships]).toEqual([['o-2', 'm-2']]);
		expect(component.selectedUserId).toBe('user-1');
		expect(component.loading).toBe(false);
	});

	it('gives a user in no organization an empty list and their name', async () => {
		const { component } = tabFor({});
		component.paramId = 'user-2';

		await component['loadOrganizations']();

		expect(component.organizations).toEqual([]);
		expect(component.selectedUserId).toBe('user-2');
		expect(component.selectedUserName).toBe('Bo Lee');
		expect(component['toastrService'].danger).not.toHaveBeenCalled();
	});

	it('names a user without a name by their email', async () => {
		const { component } = tabFor({}, { email: 'bo@ever.co' });
		component.paramId = 'user-2';

		await component['loadOrganizations']();

		expect(component.selectedUserName).toBe('bo@ever.co');
	});

	it('drops the answer for a user the page has since left, and leaves the spinner to the newer load', async () => {
		const { component } = tabFor({
			'user-1': [{ id: 'm-1', userId: 'user-1', organizationId: 'o-1', organization: org('o-1', 'Ever Co') }]
		});
		component.paramId = 'user-1';

		const load = component['loadOrganizations']();
		component.paramId = 'user-2';
		component['_loadSeq']++; // what the route change does
		await load;

		expect(component.organizations).toEqual([]);
		expect(component.selectedUserId).toBeNull();
		expect(component.loading).toBe(true);
	});

	it('drops an older load that lands after a newer one', async () => {
		let landFirst: (value: any) => void = () => undefined;
		const { component, getAll } = tabFor({});
		getAll
			.mockImplementationOnce(() => new Promise((resolve) => (landFirst = resolve)))
			.mockImplementationOnce(async () => ({
				items: [{ id: 'm-2', userId: 'user-1', organizationId: 'o-2', organization: org('o-2', 'Acme') }],
				total: 1
			}));
		component.paramId = 'user-1';

		const older = component['loadOrganizations']();
		await component['loadOrganizations']();
		landFirst({
			items: [{ id: 'm-1', userId: 'user-1', organizationId: 'o-1', organization: org('o-1', 'Ever Co') }],
			total: 1
		});
		await older;

		expect(component.organizations.map((o) => o.id)).toEqual(['o-2']);
	});
});
