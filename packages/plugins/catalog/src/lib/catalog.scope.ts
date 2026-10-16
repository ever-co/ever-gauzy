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
import { EntityManager, EntityTarget, In, IsNull, ObjectLiteral } from 'typeorm';
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

/**
 * Refuses a list of ids unless every one of them is a row the caller may use — the list form of
 * {@link assertInCallerScope} (SEC-D-04).
 *
 * The set writes (`replaceProducts`, `replaceVariants`, `replaceTags`, `replaceMedia`) insert their member rows
 * through `manager.insert`, which no core foreign-row check sees, and they checked only the SUBJECT (the collection,
 * the variant): another tenant's product, variant, tag or image went in by its id, and was read back through the
 * membership's relations.
 *
 * @param manager The entity manager to read through.
 * @param entity The member entity.
 * @param ids The member ids.
 * @param what What the members are, for the refusal.
 * @param options Which rows outside the caller's organization are still usable: the tenant's organization-less rows
 * (`tenantWide`), and the installation's tenant-less rows (`global`), as tags have.
 * @throws NotFoundException when any id is not a usable row, or no tenant is in context.
 */
export async function assertAllInCallerScope(
	manager: EntityManager,
	entity: EntityTarget<ObjectLiteral>,
	ids: readonly ID[] | null | undefined,
	what: string,
	options: { tenantWide?: boolean; global?: boolean } = {}
): Promise<void> {
	const list = ids ?? [];

	if (list.length === 0) {
		return;
	}

	const scope = callerScope();

	if (!scope.tenantId || list.some((id) => typeof id !== 'string' || id.length === 0)) {
		throw new NotFoundException(`One or more of the ${what} were not found.`);
	}

	const unique = [...new Set(list)];
	const where: object[] = [{ id: In(unique), ...scope }];

	if (options.tenantWide && scope.organizationId) {
		where.push({ id: In(unique), tenantId: scope.tenantId, organizationId: IsNull() });
	}

	if (options.global) {
		where.push({ id: In(unique), tenantId: IsNull() });
	}

	const found = await manager.count(entity, { where: where as never });

	if (found < unique.length) {
		throw new NotFoundException(`One or more of the ${what} were not found.`);
	}
}
