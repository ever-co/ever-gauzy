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
	/** The name of the route param (or query parameter) carrying the record id(s). */
	param: string;
	/**
	 * Where the id(s) come from. `params` (the default) reads a single route param; `query` reads a
	 * query parameter that may carry SEVERAL ids, and then every addressed record's organization has
	 * to allow the action.
	 */
	source?: 'params' | 'query';
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
 * On the bulk delete routes the ids live in the QUERY (`?logIds[0]=...`), and the guard used to check
 * only the organization the request NAMED — which the delete services do not necessarily use. A body
 * `organizationId` could therefore shadow the query `organizationId` the service filters by
 * (GHSA-rmq9-85v7-f365). With `source: 'query'` the guard resolves the organization of every
 * addressed record instead, so a client-named organization cannot decide the verdict on its own.
 *
 * @param entity The entity class the id(s) identify.
 * @param param The route param, or query parameter, carrying the record id(s). Defaults to `id`.
 * @param source Where to read the id(s) from: `params` (default) or `query`.
 * @returns A method decorator that stores the target on the route handler.
 */
export const OrganizationPolicyTarget = (entity: Type<unknown>, param = 'id', source: 'params' | 'query' = 'params') =>
	SetMetadata<string, IOrganizationPolicyTarget>(ORGANIZATION_POLICY_TARGET_METADATA, { entity, param, source });
