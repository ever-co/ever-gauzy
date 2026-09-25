import { EntityManager } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { DatabaseTypeEnum, isMySQL, isPostgres } from '@gauzy/config';
import { Entitlement } from './entitlement/entitlement.entity';
import { IEntitlementScope } from './entitlement.types';
import { isMikroOrmEntitlementManager } from './entitlement-persistence';

/**
 * Reads an entitlement inside the caller's transaction, under a row lock where the dialect has one.
 *
 * The lock is what makes the seat arithmetic safe. Two devices activating at the same instant both
 * read the entitlement, both count the live activations and both would take the last slot if the
 * count and the insert were not serialised; taking the row lock first means the second one counts
 * after the first has committed and is refused. Postgres and MySQL both have one, and the embedded
 * dialect serialises writers anyway, so its surrounding transaction is already exclusive — which is
 * why the lock is requested only where it means something rather than being emulated.
 *
 * Under MikroORM the same read is one `findOne` with a pessimistic write lock, on the same two dialects
 * and scoped by the same three predicates — the right, its tenant and its organization, and only a live
 * row — so the lock a lifecycle transition is decided under is the same lock on either ORM.
 *
 * @param manager The caller's transaction manager.
 * @param id The entitlement to read.
 * @param scope The tenant and organization the read is scoped to; the request context is the fallback
 * so an event consumer, which runs outside any request, passes the envelope's own identifiers.
 * @returns The entitlement, scoped to the caller's tenant and organization, or null when it is not
 * the caller's.
 */
export async function lockEntitlement(
	manager: EntityManager,
	id: ID,
	scope: IEntitlementScope = {}
): Promise<Entitlement | null> {
	const tenantId = scope.tenantId ?? RequestContext.currentTenantId();
	const organizationId = scope.organizationId ?? RequestContext.currentOrganizationId();

	if (isMikroOrmEntitlementManager(manager)) {
		return await manager.lockOne(
			Entitlement,
			{
				id,
				deletedAt: null,
				...(tenantId ? { tenantId } : {}),
				...(organizationId ? { organizationId } : {})
			},
			isPostgres() || isMySQL()
		);
	}

	const query = manager
		.createQueryBuilder(Entitlement, 'entitlement')
		.where('entitlement.id = :id', { id })
		.andWhere('entitlement.deletedAt IS NULL');

	if (tenantId) {
		query.andWhere('entitlement.tenantId = :tenantId', { tenantId });
	}

	if (organizationId) {
		query.andWhere('entitlement.organizationId = :organizationId', { organizationId });
	}

	const dialect = manager.connection.options.type as DatabaseTypeEnum;

	if (dialect === DatabaseTypeEnum.postgres || dialect === DatabaseTypeEnum.mysql) {
		return await query.setLock('pessimistic_write').getOne();
	}

	return await query.getOne();
}
