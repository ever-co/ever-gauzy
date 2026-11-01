import {
	ORGANIZATION_CONTACT_CREATE_PERMISSIONS,
	ORGANIZATION_CONTACT_DELETE_PERMISSIONS,
	PermissionsEnum
} from '@gauzy/contracts';
import { CONTACT_ACTION_PERMISSIONS } from './contact-action-permissions';

/**
 * The contacts page's actions after the create and delete grants were split from ORG_CONTACT_EDIT
 * (ever-co/ever-gauzy#5468): each shows to its own holders, and to everyone it showed to before.
 */
describe('CONTACT_ACTION_PERMISSIONS', () => {
	it.each(Object.entries(CONTACT_ACTION_PERMISSIONS))(
		'still shows %s to a holder of ORG_CONTACT_EDIT, which showed every action before',
		(_action, permissions) => {
			expect(permissions).toContain(PermissionsEnum.ORG_CONTACT_EDIT);
		}
	);

	it('shows Add and Delete to the holders the API lets create and delete', () => {
		expect(CONTACT_ACTION_PERMISSIONS.add).toEqual([...ORGANIZATION_CONTACT_CREATE_PERMISSIONS]);
		expect(CONTACT_ACTION_PERMISSIONS.delete).toEqual([...ORGANIZATION_CONTACT_DELETE_PERMISSIONS]);
		expect(CONTACT_ACTION_PERMISSIONS.add).toContain(PermissionsEnum.ORG_CONTACT_ADD);
		expect(CONTACT_ACTION_PERMISSIONS.delete).toContain(PermissionsEnum.ORG_CONTACT_DELETE);
	});

	it('keeps Edit and Invite to ORG_CONTACT_EDIT: the new grants do not reach them', () => {
		expect(CONTACT_ACTION_PERMISSIONS.edit).toEqual([PermissionsEnum.ORG_CONTACT_EDIT]);
		expect(CONTACT_ACTION_PERMISSIONS.invite).toEqual([PermissionsEnum.ORG_CONTACT_EDIT]);
	});

	it('opens a contact for every reader the contacts pages admit, so readers reach its notes', () => {
		expect(CONTACT_ACTION_PERMISSIONS.view).toEqual(
			expect.arrayContaining([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_CONTACT_VIEW])
		);
	});
});
