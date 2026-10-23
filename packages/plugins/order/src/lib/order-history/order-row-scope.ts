import { DeepPartial, ObjectLiteral, Repository } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { MikroOrmBaseEntityRepository, MultiORM, MultiORMEnum, RequestContext, wrapSerialize } from '@gauzy/core';

/**
 * The tenancy of an order, which every row written *about* the order carries.
 *
 * The summary of a version and an entry on the timeline belong to the order's tenant and organization,
 * whoever caused them. On a request those are also the caller's; on a scheduled pass there is no caller,
 * and the order row is the only thing that can say whose they are.
 */
export interface IOrderRowScope {
	/** The order's tenant. */
	tenantId?: ID | null;
	/** The order's organization. */
	organizationId?: ID | null;
}

/**
 * The tenancy a row states, reduced to the members it actually has.
 *
 * A member the row does not carry is left out rather than written as `undefined`, so spreading the
 * result over a payload can never erase a value the payload already states.
 *
 * @param row An order, a change, or anything else that carries the order's tenancy columns.
 * @returns The columns, as the row states them.
 */
export function scopeOfOrderRow(row: IOrderRowScope | null | undefined): IOrderRowScope {
	return {
		...(row?.tenantId ? { tenantId: row.tenantId } : {}),
		...(row?.organizationId ? { organizationId: row.organizationId } : {})
	};
}

/**
 * The tenancy of a row as a payload both ORMs write: each column beside the relation it is the key of.
 *
 * The pair is stated the way the platform's tenant-aware create states the tenant — `{ tenant: { id },
 * tenantId }` — and for the same reason. Under TypeORM the scalar is a mapped column and is written;
 * under MikroORM it is the relation's id (`relationId: true` maps it `persist: false`), so only the
 * relation reference reaches the statement, and a payload that stated the scalar alone would insert the
 * row with the column empty.
 *
 * @param scope The order's tenancy.
 * @returns The columns and their relation references, for the members the scope has.
 */
export function orderScopeColumns(scope: IOrderRowScope | null | undefined): Record<string, unknown> {
	const stated = scopeOfOrderRow(scope);

	return {
		...(stated.tenantId ? { tenant: { id: stated.tenantId }, tenantId: stated.tenantId } : {}),
		...(stated.organizationId
			? { organization: { id: stated.organizationId }, organizationId: stated.organizationId }
			: {})
	};
}

/**
 * The service a row about an order is written through, reduced to what the write needs.
 *
 * `create` is the tenant-aware one, which stamps the caller's tenant; the two repositories are the ones
 * the service was constructed with, used only when there is no caller to stamp.
 */
export interface IOrderScopedWriter<T extends ObjectLiteral> {
	/** The ORM the platform's CRUD layer reads and writes through. */
	readonly ormType: MultiORM;
	/** The tenant-aware create. */
	create(entity: DeepPartial<T>): Promise<T>;
}

/**
 * Writes one row about an order, carrying the order's own tenant and organization.
 *
 * **On a request, the tenant-aware create stays the authority**: the caller's tenant is stamped on the
 * row exactly as it is on every other write the platform makes, and the order's organization rides
 * along, because the base create states no organization of its own and a row that carries none is one
 * the organization's scoped reads cannot find.
 *
 * **With no request, the order's tenancy is written as the order states it.** The tenant-aware create
 * reads the tenant from the request context and overwrites whatever the payload said — which, with no
 * user, is `null`. So a scheduled pass that cancelled a stale change or repaired a drifted order wrote its
 * `order_summary` and `order_history` rows with no tenant at all, and the tenant whose order it was could
 * never see them: the repair, and the reason for it, were missing from the order's own timeline. The
 * row is written through the repository the service holds for the configured ORM instead, with the
 * tenancy stated, which is what the version-predicated order write beside it already does.
 *
 * @param writer The service the row belongs to.
 * @param repositories The repositories that service was constructed with.
 * @param row The row, without its tenancy. A row that names its order states the relation reference
 * beside the id (`order: { id }, orderId`), for the reason {@link orderScopeColumns} gives.
 * @param scope The order's tenancy, read from the order row.
 * @returns The row, as written.
 */
export async function createUnderOrderScope<T extends ObjectLiteral>(
	writer: IOrderScopedWriter<T>,
	repositories: { typeOrm: Repository<T>; mikroOrm: MikroOrmBaseEntityRepository<T> },
	row: Record<string, unknown>,
	scope: IOrderRowScope | undefined
): Promise<T> {
	const scoped = { ...row, ...orderScopeColumns(scope) } as DeepPartial<T>;

	if (!scopeOfOrderRow(scope).tenantId || RequestContext.currentTenantId()) {
		return writer.create(scoped);
	}

	if (writer.ormType === MultiORMEnum.MikroORM) {
		// The options the platform's own create passes, so the row is built exactly as every other row the
		// CRUD layer writes on this ORM is: the relation references are taken as references to rows that
		// exist, rather than as new rows to cascade an insert into.
		const entity = repositories.mikroOrm.create(scoped as never, { partial: true, managed: true } as never);

		await repositories.mikroOrm.persistAndFlush(entity);

		// Serialised as the CRUD layer serialises what it creates on this ORM, so a caller is answered with
		// the same plain row whichever of the two paths wrote it.
		return wrapSerialize(entity as T);
	}

	return repositories.typeOrm.save(repositories.typeOrm.create(scoped));
}
