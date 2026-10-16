import { BadRequestException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';

/**
 * The organization a GraphQL write is narrowed to, refused when the caller names none.
 *
 * Some writes take the organization as an argument their REST twin REQUIRES (`TenantOrganizationBaseDTO`,
 * `DeleteQueryDTO`) and uses to narrow the statement. Declared nullable on GraphQL, an omitted organization was
 * dropped from the criteria (`undefined: 'ignore'`) and the write ran across the whole tenant; the membership
 * interceptor only checks an organization that is stated (SEC-A-02). A stated one is still checked by that
 * interceptor; this refuses the absent one, as the route's validation does.
 *
 * @param organizationId What the caller stated.
 * @param field The field, for the message.
 * @returns The organization.
 * @throws BadRequestException with `ORGANIZATION_REQUIRED` when none was stated.
 */
export function requireOrganization(organizationId: ID | null | undefined, field: string): ID {
	if (!organizationId) {
		throw new BadRequestException({
			message: `ORGANIZATION_REQUIRED: ${field} is narrowed to one organization of the caller; name it with organizationId.`,
			code: 'ORGANIZATION_REQUIRED'
		});
	}
	return organizationId;
}
