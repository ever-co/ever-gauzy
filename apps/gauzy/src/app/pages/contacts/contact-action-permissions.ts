import {
	ORGANIZATION_CONTACT_CREATE_PERMISSIONS,
	ORGANIZATION_CONTACT_DELETE_PERMISSIONS,
	PermissionsEnum
} from '@gauzy/contracts';

/** An action of the contacts page. */
export type ContactAction = 'view' | 'add' | 'edit' | 'invite' | 'delete';

/**
 * Who sees each action of the contacts page: a holder of any one of the listed permissions (the lists feed
 * `ngxPermissionsOnly`, which reads a list as alternatives).
 *
 * Every list holds `ORG_CONTACT_EDIT`, which showed every action before the create and delete grants were split
 * from it (ever-co/ever-gauzy#5468), so nobody loses an action. Add and Delete follow the API's own lists. View also
 * opens for the readers the contacts pages admit (`ALL_ORG_EDIT`, `ORG_CONTACT_VIEW`), who can now read a contact's
 * notes (ever-co/ever-gauzy#1114).
 */
export const CONTACT_ACTION_PERMISSIONS: Readonly<Record<ContactAction, PermissionsEnum[]>> = Object.freeze({
	view: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_CONTACT_VIEW, PermissionsEnum.ORG_CONTACT_EDIT],
	add: [...ORGANIZATION_CONTACT_CREATE_PERMISSIONS],
	edit: [PermissionsEnum.ORG_CONTACT_EDIT],
	invite: [PermissionsEnum.ORG_CONTACT_EDIT],
	delete: [...ORGANIZATION_CONTACT_DELETE_PERMISSIONS]
});
