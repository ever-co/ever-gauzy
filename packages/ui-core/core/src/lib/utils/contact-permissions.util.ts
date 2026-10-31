import { PermissionsEnum } from '@gauzy/contracts';

/** The permission checks a caller of {@link mayOpenContactAddForm} answers: the `Store`'s own. */
export interface IPermissionChecks {
	hasAnyPermission(...permissions: PermissionsEnum[]): boolean;
	hasAllPermissions(...permissions: PermissionsEnum[]): boolean;
}

/**
 * Whether the user is offered the shortcuts that open a contacts page's add form (the header's quick actions, the
 * sidebar's "+" links): those who were offered them before — `ORG_CONTACT_EDIT` or `ALL_ORG_EDIT` — and a holder of
 * `ORG_CONTACT_ADD` (ever-co/ever-gauzy#5468) who can also open the contacts pages, which admit `ALL_ORG_EDIT` and
 * `ORG_CONTACT_VIEW`. Without that, the shortcut would land on a page the user is turned away from.
 */
export function mayOpenContactAddForm(permissions: IPermissionChecks): boolean {
	return (
		permissions.hasAnyPermission(PermissionsEnum.ORG_CONTACT_EDIT, PermissionsEnum.ALL_ORG_EDIT) ||
		permissions.hasAllPermissions(PermissionsEnum.ORG_CONTACT_ADD, PermissionsEnum.ORG_CONTACT_VIEW)
	);
}

/**
 * The projects the contact form offers to link to a new contact.
 *
 * A holder of `ORG_CONTACT_EDIT` may link any project of the organization. A user who creates contacts without it
 * (`ORG_CONTACT_ADD`, ever-co/ever-gauzy#5468) creates them in create-only mode, where the server links only the
 * projects that have no contact yet, so only those are offered. The server still refuses any other project, and the
 * form shows its message.
 */
export function projectsLinkableToNewContact<P extends { organizationContactId?: unknown }>(
	permissions: IPermissionChecks,
	projects: P[]
): P[] {
	return permissions.hasAnyPermission(PermissionsEnum.ORG_CONTACT_EDIT)
		? projects
		: projects.filter((project) => !project.organizationContactId);
}
