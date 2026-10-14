/**
 * The caller's scope for the catalogue's set writes, and the ownership check every one of them runs first.
 *
 * A set write — "these are the channels this variant is published on", "this is the gallery", "these are the
 * facets" — reads the rows the subject already has, deletes the ones missing from the new set by id, and
 * updates or inserts the rest. When that read is by the subject's id alone, a caller who names another tenant's
 * variant, product or collection deletes and rewrites that tenant's rows (review R2-19, R2-20). The collection
 * membership services were fixed for exactly this; this module is the same fix, stated once, for the others.
 */
import { NotFoundException } from '@nestjs/common';
import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';

/**
 * The caller's tenant and organization as criteria, each only when the credential states it.
 *
 * A key present with an undefined value is a criterion the two ORMs read differently, and a `null` organization
 * is `organizationId IS NULL` under the platform's `invalidWhereValuesBehavior.null = 'sql-null'` — so a member
 * the caller does not state is left out rather than written as either.
 *
 * @returns The scope; empty for a caller with no request.
 */
export function callerScope(): { tenantId?: ID; organizationId?: ID } {
	const tenantId = RequestContext.currentTenantId();
	const organizationId = RequestContext.currentOrganizationId();

	return { ...(tenantId ? { tenantId } : {}), ...(organizationId ? { organizationId } : {}) };
}

/**
 * Refuses a subject that is not the caller's, answering it as one that does not exist.
 *
 * Not found rather than forbidden, so the answer for another tenant's id is the answer for an id nobody holds.
 *
 * @param manager The manager the write runs through.
 * @param entity The subject's entity — the variant, product or collection the set belongs to.
 * @param id The subject the caller named.
 * @param what How the refusal names the subject.
 * @throws NotFoundException When no row of that id is in the caller's tenant and organization.
 */
export async function assertInCallerScope(
	manager: EntityManager,
	entity: EntityTarget<ObjectLiteral>,
	id: ID,
	what: string
): Promise<void> {
	const found = id ? await manager.count(entity, { where: { id, ...callerScope() } as never }) : 0;

	if (!found) {
		throw new NotFoundException(`The ${what} was not found.`);
	}
}
