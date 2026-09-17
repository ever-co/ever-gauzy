import { Injectable } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
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
	 * @param orderId The order.
	 * @param action The machine action key, from the vocabulary the order specification fixes:
	 * `ORDER_PLACED`, `ORDER_CONFIRMED`, `ORDER_COMPLETED`, `ORDER_CANCELED`, `ORDER_ARCHIVED`,
	 * `CHANGE_REQUESTED`, `CHANGE_CONFIRMED`, `CHANGE_DECLINED`, `CHANGE_CANCELED`, `NOTE_ADDED`.
	 * @param title A human title for the timeline.
	 * @param metadata The action's payload fragment.
	 * @returns The appended row.
	 */
	public async record(
		orderId: ID,
		action: string,
		title?: string,
		metadata?: Record<string, unknown>
	): Promise<OrderHistory> {
		const currentUserId = RequestContext.currentUserId();

		return this.create({
			orderId,
			action,
			title,
			description: (metadata?.['description'] as string) ?? undefined,
			userId: currentUserId ?? undefined,
			metadata
		} as any);
	}

	/**
	 * Reads an order's timeline in the order it happened.
	 *
	 * @param orderId The order.
	 * @returns The entries, oldest first.
	 */
	public async timeline(orderId: ID): Promise<OrderHistory[]> {
		const page = await this.findAll({ where: { orderId } });

		return [...page.items].sort(
			(left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
		);
	}
}
