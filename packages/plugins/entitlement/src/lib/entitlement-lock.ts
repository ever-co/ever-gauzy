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

/**
 * Holds the order line a grant is for until the grant's transaction ends, where the dialect has row locks.
 *
 * What serialises two grants of one line when `UQ_entitlement_live_line_grant` is missing (a database whose
 * existing duplicates kept the migration from creating it): the second grant waits here until the first has
 * committed, and its read under the lock then finds the first one's right. The row is the order line the right's
 * `FK_entitlement_order_line` points at, so it exists for every grant the insert would accept; nothing of it is
 * read. Taken as the transaction's first statement, so that MySQL's REPEATABLE READ snapshot, which its first plain
 * read takes, comes after the lock. The embedded dialect serialises its writers, so nothing is asked for there, as
 * in {@link lockEntitlement}.
 *
 * @param manager The grant's transaction manager.
 * @param orderLineId The order line the grant is for.
 */
export async function lockOrderLine(manager: EntityManager, orderLineId: ID): Promise<void> {
	if (isMikroOrmEntitlementManager(manager)) {
		if (isPostgres() || isMySQL()) {
			// On the transaction's own connection; knex binds `?` on both dialects.
			const statement = isMySQL()
				? 'SELECT `id` FROM `order_line` WHERE `id` = ? FOR UPDATE'
				: 'SELECT "id" FROM "order_line" WHERE "id" = ? FOR UPDATE';
			await manager.em
				.getConnection()
				.execute(statement, [orderLineId], 'all', manager.em.getTransactionContext());
		}
		return;
	}

	const dialect = manager.connection.options.type as DatabaseTypeEnum;

	if (dialect === DatabaseTypeEnum.postgres) {
		await manager.query(`SELECT "id" FROM "order_line" WHERE "id" = $1 FOR UPDATE`, [orderLineId]);
	} else if (dialect === DatabaseTypeEnum.mysql) {
		await manager.query('SELECT `id` FROM `order_line` WHERE `id` = ? FOR UPDATE', [orderLineId]);
	}
}
