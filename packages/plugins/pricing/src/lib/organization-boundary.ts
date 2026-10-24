import { ID, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';

/** The roles that reach every organization of their tenant. */
const TENANT_ADMIN_ROLES: ReadonlyArray<RolesEnum> = Object.freeze([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]);

/**
 * The organization a pricing read by id is confined to, as `inCallerOrganization` (organization-scope.ts) applies it.
 *
 * The platform's organization rule (owner decision, 2026-10-22): a tenant admin — role `SUPER_ADMIN` or `ADMIN` —
 * reaches every organization of the tenant; everyone else only the organization of their token
 * (`RequestContext.currentOrganizationId()`, the one they last switched to). The role is the one the user holds now,
 * as loaded for this request, never the claim frozen into the token.
 *
 * Kept apart from `organization-scope.ts`, which stays free of `@gauzy/core` so its own spec loads without it.
 *
 * @returns The caller's organization, or `null` when the read is not confined: a tenant admin, or a read with no
 * organization in context (a job).
 */
export function confiningOrganizationId(): ID | null {
	if (RequestContext.hasRoles([...TENANT_ADMIN_ROLES])) {
		return null;
	}

	return RequestContext.currentOrganizationId() ?? null;
}
