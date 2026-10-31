import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { IOrganizationContactCreateOptions } from './commands/organization-contact-create.command';

/**
 * Creating a contact: `ORG_CONTACT_ADD`, or `ORG_CONTACT_EDIT`, which has always allowed it. The two are
 * alternatives (`@Permissions` passes a caller holding any one of them), so nobody who could create a contact
 * before loses it.
 */
export const ORGANIZATION_CONTACT_CREATE_PERMISSIONS: readonly PermissionsEnum[] = Object.freeze([
	PermissionsEnum.ORG_CONTACT_ADD,
	PermissionsEnum.ORG_CONTACT_EDIT
]);

/**
 * Deleting or withdrawing a contact: `ORG_CONTACT_DELETE`, or `ORG_CONTACT_EDIT`, which has always allowed it.
 */
export const ORGANIZATION_CONTACT_DELETE_PERMISSIONS: readonly PermissionsEnum[] = Object.freeze([
	PermissionsEnum.ORG_CONTACT_DELETE,
	PermissionsEnum.ORG_CONTACT_EDIT
]);

/**
 * How the current caller's create runs: a caller who may create contacts but not edit them (`ORG_CONTACT_ADD`
 * without `ORG_CONTACT_EDIT`) creates only — the create cannot name or reach a row that already exists. A
 * holder of `ORG_CONTACT_EDIT` creates exactly as before.
 */
export function organizationContactCreateOptions(): IOrganizationContactCreateOptions {
	return { createOnly: !RequestContext.hasPermission(PermissionsEnum.ORG_CONTACT_EDIT) };
}
