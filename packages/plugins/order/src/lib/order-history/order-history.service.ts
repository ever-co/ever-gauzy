import { Injectable } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { IOrderRowScope, createUnderOrderScope } from './order-row-scope';
import { OrderHistory } from './order-history.entity';
import { TypeOrmOrderHistoryRepository } from './repository/type-orm-order-history.repository';
import { MikroOrmOrderHistoryRepository } from './repository/mikro-orm-order-history.repository';

/**
 * The order's own timeline.
 *
 * The timeline is written by this service rather than by the controllers, so that a transition caused
 * by a scheduled job, a provider callback or a subscriber produces exactly the same entry as one caused
 * by a person pressing a button. That is the property that makes the timeline worth reading: it is a
 * record of what happened to the order, not of what was requested over HTTP.
 */
@Injectable()
export class OrderHistoryService extends TenantAwareCrudService<OrderHistory> {
	constructor(
		readonly typeOrmOrderHistoryRepository: TypeOrmOrderHistoryRepository,
		readonly mikroOrmOrderHistoryRepository: MikroOrmOrderHistoryRepository
	) {
		super(typeOrmOrderHistoryRepository, mikroOrmOrderHistoryRepository);
	}

	/**
	 * Appends one entry to an order's timeline.
	 *
	 * **The entry belongs to the order's tenant and organization, whoever caused it.** A caller that has
	 * the order row states its tenancy in `scope`, and it is written as stated when no request is behind
	 * the call — which is the whole point of writing the timeline here rather than in a controller: a
	 * change the worker's staleness sweep cancelled has to appear on the order's timeline exactly as one
	 * an operator cancelled does, and the tenant-aware create alone would have written it with no tenant,
	 * where the order's own tenant can never read it. See {@link createUnderOrderScope}.
	 *
	 * @param orderId The order.
	 * @param action The machine action key, from the vocabulary the order specification fixes:
	 * `ORDER_PLACED`, `ORDER_CONFIRMED`, `ORDER_COMPLETED`, `ORDER_CANCELED`, `ORDER_ARCHIVED`,
	 * `CHANGE_REQUESTED`, `CHANGE_CONFIRMED`, `CHANGE_DECLINED`, `CHANGE_CANCELED`, `NOTE_ADDED`.
	 * @param title A human title for the timeline.
	 * @param metadata The action's payload fragment.
	 * @param scope The order's tenancy, read from the order or a row of its aggregate. A caller that
	 * states none keeps the tenant-aware create's behaviour.
	 * @returns The appended row.
	 */
	public async record(
		orderId: ID,
		action: string,
		title?: string,
		metadata?: Record<string, unknown>,
		scope?: IOrderRowScope
	): Promise<OrderHistory> {
		const currentUserId = RequestContext.currentUserId();

		return createUnderOrderScope<OrderHistory>(
			this,
			{ typeOrm: this.typeOrmOrderHistoryRepository, mikroOrm: this.mikroOrmOrderHistoryRepository },
			{
				// The relation beside its id, because under MikroORM the id alone is not what is written.
				order: { id: orderId },
				orderId,
				action,
				title,
				description: (metadata?.['description'] as string) ?? undefined,
				userId: currentUserId ?? undefined,
				metadata
			},
			scope
		);
	}

	/**
	 * Reads an order's timeline in the order it happened.
	 *
	 * **The order is total: the instant, then the identity.** The timeline is paged with offset cursors
	 * (`orderHistory`), so the order it is read in has to be one no read can rearrange — and the instant
	 * alone is not: one move writes several entries within one clock tick (a change's request, the note an
	 * action records and the confirmation), and rows the order leaves tied come back in whatever order the
	 * store chooses on that read, so a cursor walk could answer one entry twice and never another. The store
	 * is asked for `createdAt, id`, and the sort in memory, which is what guarantees the order whatever the
	 * store did with the request, breaks the same tie the same way.
	 *
	 * @param orderId The order.
	 * @param withDeleted Whether entries retired from the timeline are included. Stated through the find
	 * options rather than as a filter on the rows handed back, because the store is what knows a row was
	 * retired.
	 * @returns The entries, oldest first, and in identity order within one instant.
	 */
	public async timeline(orderId: ID, withDeleted?: boolean): Promise<OrderHistory[]> {
		const page = await this.findAll({
			where: { orderId },
			order: { createdAt: 'ASC', id: 'ASC' },
			...(withDeleted ? { withDeleted: true } : {})
		});

		return [...page.items].sort(
			(left, right) =>
				new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() ||
				compareIds(left.id, right.id)
		);
	}
}

/**
 * Orders two identifiers the way the store orders the column.
 *
 * The identifiers are lowercase UUID text, which every supported dialect orders by its characters, so a plain
 * comparison of the strings is the store's own order; a missing identifier sorts first rather than throwing.
 *
 * @param left One identifier.
 * @param right The other.
 * @returns A negative number, zero or a positive number, as `Array.prototype.sort` takes it.
 */
function compareIds(left: ID | undefined, right: ID | undefined): number {
	const a = String(left ?? '');
	const b = String(right ?? '');

	return a < b ? -1 : a > b ? 1 : 0;
}
