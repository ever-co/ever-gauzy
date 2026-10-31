import { Route } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { routes } from './edit-organization-routing.module';

/** The child route of the organization edit page at `path`. */
const child = (path: string): Route => routes[0].children.find((route) => route.path === path);

/**
 * The settings page is every organization editor's (ALL_ORG_EDIT). Its EEA/UK checks read the organization's country
 * from its contact, which the API answers only with ORG_CONTACT_VIEW and otherwise refuses the whole read over, so the
 * page asks for the contact only when the user may load it.
 */
describe('EditOrganizationRoutingModule — what the organization read loads per page', () => {
	it('opens the settings page for every organization editor', () => {
		expect(routes[0].data.permissions.only).toEqual([PermissionsEnum.ALL_ORG_EDIT]);
	});

	it('asks for the contact on the settings page only with ORG_CONTACT_VIEW', () => {
		expect(child('settings').data.relations).toEqual(['accountingTemplates']);
		expect(child('settings').data.permittedRelations).toEqual({ contact: PermissionsEnum.ORG_CONTACT_VIEW });
	});

	it('keeps the other pages’ reads as they were', () => {
		expect(child('main').data.relations).toEqual(['tags']);
		expect(child('location').data.relations).toEqual(['contact']);
		expect(child('main').data.permittedRelations).toBeUndefined();
		expect(child('location').data.permittedRelations).toBeUndefined();
	});
});
