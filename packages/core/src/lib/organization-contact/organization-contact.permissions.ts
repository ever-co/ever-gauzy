import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { IOrganizationContactCreateOptions } from './commands/organization-contact-create.command';

/**
 * How the current caller's create runs: a caller who may create contacts but not edit them (`ORG_CONTACT_ADD`
 * without `ORG_CONTACT_EDIT`) creates only — the create cannot name or reach a row that already exists. A
 * holder of `ORG_CONTACT_EDIT` creates exactly as before.
 */
export function organizationContactCreateOptions(): IOrganizationContactCreateOptions {
	return { createOnly: !RequestContext.hasPermission(PermissionsEnum.ORG_CONTACT_EDIT) };
}
