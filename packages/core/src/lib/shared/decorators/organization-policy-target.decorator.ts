import { SetMetadata, Type } from '@nestjs/common';

/**
 * Metadata key read by `OrganizationPermissionGuard` to find the record a route mutates.
 */
export const ORGANIZATION_POLICY_TARGET_METADATA = 'organizationPolicyTarget';

/**
 * Describes the persisted record an `OrganizationPermissionGuard` route addresses by id.
 */
export interface IOrganizationPolicyTarget {
	/** The tenant-scoped entity class the route param identifies. It must have an `organizationId` column. */
	entity: Type<unknown>;
	/** The name of the route param carrying the record id. */
	param: string;
}

/**
 * Tells `OrganizationPermissionGuard` that the route mutates an existing record identified by a route
 * param, so the organization policy of THAT record's organization has to allow the action.
 *
 * Without it the guard can only evaluate the organization the request names (body, query or params)
 * or the caller's own employee organization, and a caller with no employee record could name a
 * permissive organization while addressing a record that lives in an organization whose policy is
 * switched off. With it the guard loads the record inside the caller's tenant, denies when it does not
 * exist there, and requires the record's organization to allow the action as well.
 *
 * @param entity The entity class the route param identifies.
 * @param param The route param carrying the record id. Defaults to `id`.
 * @returns A method decorator that stores the target on the route handler.
 */
export const OrganizationPolicyTarget = (entity: Type<unknown>, param = 'id') =>
	SetMetadata<string, IOrganizationPolicyTarget>(ORGANIZATION_POLICY_TARGET_METADATA, { entity, param });
