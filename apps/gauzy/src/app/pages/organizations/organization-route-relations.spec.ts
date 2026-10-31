import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Data, Router } from '@angular/router';
import { Observable, lastValueFrom, of, throwError } from 'rxjs';
import { IOrganization, PermissionsEnum } from '@gauzy/contracts';
import { AuthService, OrganizationsService, Store } from '@gauzy/ui-core/core';
import { organizationRouteRelations, permissionHolder } from './organization-route-relations';
import { OrganizationResolver } from './organization.resolver';

/** The settings route's data: the accounting templates always, the contact with ORG_CONTACT_VIEW. */
const SETTINGS_ROUTE_DATA: Data = {
	relations: ['accountingTemplates'],
	permittedRelations: { contact: PermissionsEnum.ORG_CONTACT_VIEW }
};

/** Holds the given permissions. */
const holding =
	(...granted: PermissionsEnum[]) =>
	(permission: PermissionsEnum): Observable<boolean> =>
		of(granted.includes(permission));

/**
 * The organization settings page is every organization editor's (ALL_ORG_EDIT), but the API answers the
 * organization's contact, which holds the country its EEA/UK checks read (#9873, #9872), only with ORG_CONTACT_VIEW,
 * and refuses the whole read otherwise. The page asks for the contact only when the user may load it.
 */
describe('organizationRouteRelations', () => {
	it('asks for the relations a route names, as before, when it names no permitted relation', async () => {
		const holds = jest.fn(holding());

		await expect(lastValueFrom(organizationRouteRelations({ relations: ['tags'] }, holds))).resolves.toEqual([
			'tags'
		]);
		await expect(lastValueFrom(organizationRouteRelations(undefined, holds))).resolves.toEqual([]);
		expect(holds).not.toHaveBeenCalled();
	});

	it('adds a permitted relation for a user who holds its permission', async () => {
		const relations = organizationRouteRelations(SETTINGS_ROUTE_DATA, holding(PermissionsEnum.ORG_CONTACT_VIEW));

		await expect(lastValueFrom(relations)).resolves.toEqual(['accountingTemplates', 'contact']);
	});

	it('leaves it out for a user who does not, so the page still opens', async () => {
		const relations = organizationRouteRelations(SETTINGS_ROUTE_DATA, holding(PermissionsEnum.ALL_ORG_EDIT));

		await expect(lastValueFrom(relations)).resolves.toEqual(['accountingTemplates']);
	});

	it('leaves it out when the permission cannot be checked', async () => {
		const failing = organizationRouteRelations(SETTINGS_ROUTE_DATA, () => throwError(() => new Error('offline')));
		const silent = organizationRouteRelations(SETTINGS_ROUTE_DATA, () => of<boolean>());

		await expect(lastValueFrom(failing)).resolves.toEqual(['accountingTemplates']);
		await expect(lastValueFrom(silent)).resolves.toEqual(['accountingTemplates']);
	});
});

describe('permissionHolder', () => {
	it('answers from the loaded permissions when they include it, without asking the API', async () => {
		const auth = { hasPermissions: jest.fn(() => of(false)) };
		const holds = permissionHolder({ hasPermission: () => true }, auth);

		await expect(lastValueFrom(holds(PermissionsEnum.ORG_CONTACT_VIEW))).resolves.toBe(true);
		expect(auth.hasPermissions).not.toHaveBeenCalled();
	});

	it('asks the API otherwise, as on a direct link before the permissions have loaded', async () => {
		const auth = { hasPermissions: jest.fn(() => of(true)) };
		const holds = permissionHolder({ hasPermission: () => false }, auth);

		await expect(lastValueFrom(holds(PermissionsEnum.ORG_CONTACT_VIEW))).resolves.toBe(true);
		expect(auth.hasPermissions).toHaveBeenCalledWith(PermissionsEnum.ORG_CONTACT_VIEW);
	});
});

/** The resolver as it is written: it reads the route alone, and always answers an observable. */
const resolveOrganization = OrganizationResolver as unknown as (route: ActivatedRouteSnapshot) => Observable<unknown>;

describe('OrganizationResolver — the settings route', () => {
	const ORGANIZATION = { id: 'organization-1', name: 'Ever' } as IOrganization;
	let getById: jest.Mock;
	let navigate: jest.Mock;
	let granted: PermissionsEnum[];

	const resolve = async (): Promise<unknown> => {
		const route = { params: { id: ORGANIZATION.id }, firstChild: { data: SETTINGS_ROUTE_DATA } };
		const resolved = TestBed.runInInjectionContext(() =>
			resolveOrganization(route as unknown as ActivatedRouteSnapshot)
		);
		return lastValueFrom(resolved);
	};

	beforeEach(() => {
		granted = [PermissionsEnum.ALL_ORG_EDIT];
		getById = jest.fn(() => of(ORGANIZATION));
		navigate = jest.fn();
		TestBed.configureTestingModule({
			providers: [
				{ provide: Router, useValue: { navigate } },
				{ provide: OrganizationsService, useValue: { getById } },
				{ provide: Store, useValue: { hasPermission: () => false } },
				{
					provide: AuthService,
					useValue: { hasPermissions: (permission: PermissionsEnum) => of(granted.includes(permission)) }
				}
			]
		});
	});

	it('opens the page for an organization editor without ORG_CONTACT_VIEW, reading no contact', async () => {
		await expect(resolve()).resolves.toBe(ORGANIZATION);

		expect(getById).toHaveBeenCalledWith(ORGANIZATION.id, ['accountingTemplates']);
		expect(navigate).not.toHaveBeenCalled();
	});

	it('reads the contact, and with it the country, for an editor who holds ORG_CONTACT_VIEW', async () => {
		granted.push(PermissionsEnum.ORG_CONTACT_VIEW);

		await expect(resolve()).resolves.toBe(ORGANIZATION);

		expect(getById).toHaveBeenCalledWith(ORGANIZATION.id, ['accountingTemplates', 'contact']);
	});
});
