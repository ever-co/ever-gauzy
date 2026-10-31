import { PermissionsEnum } from '@gauzy/contracts';
import { IPermissionChecks, mayOpenContactAddForm } from './contact-permissions.util';

/** The checks of a user holding `granted`, as the `Store` answers them. */
const holding = (...granted: PermissionsEnum[]): IPermissionChecks => ({
	hasAnyPermission: (...required) => required.some((permission) => granted.includes(permission)),
	hasAllPermissions: (...required) => required.every((permission) => granted.includes(permission))
});

const { ALL_ORG_EDIT, ALL_ORG_VIEW, ORG_CONTACT_ADD, ORG_CONTACT_DELETE, ORG_CONTACT_EDIT, ORG_CONTACT_VIEW } =
	PermissionsEnum;

describe('mayOpenContactAddForm', () => {
	it.each([
		['ORG_CONTACT_EDIT', [ORG_CONTACT_EDIT]],
		['ALL_ORG_EDIT', [ALL_ORG_EDIT]],
		['ORG_CONTACT_ADD with ORG_CONTACT_VIEW', [ORG_CONTACT_ADD, ORG_CONTACT_VIEW]],
		['ORG_CONTACT_ADD with ALL_ORG_EDIT', [ORG_CONTACT_ADD, ALL_ORG_EDIT]]
	])('offers the add form to a holder of %s', (_label, granted) => {
		expect(mayOpenContactAddForm(holding(...granted))).toBe(true);
	});

	it.each([
		['nothing', []],
		['ORG_CONTACT_VIEW alone', [ORG_CONTACT_VIEW]],
		['ORG_CONTACT_DELETE with ORG_CONTACT_VIEW', [ORG_CONTACT_DELETE, ORG_CONTACT_VIEW]],
		// The contacts pages turn this user away, so the shortcut would land elsewhere.
		['ORG_CONTACT_ADD without access to the contacts pages', [ORG_CONTACT_ADD, ALL_ORG_VIEW]]
	])('does not offer it to a holder of %s', (_label, granted) => {
		expect(mayOpenContactAddForm(holding(...granted))).toBe(false);
	});
});
