import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import {
	AddressType,
	ID,
	IPagination,
	OrderChangeActionType,
	OrderChangeStatus,
	OrderChangeType,
	OrderStatus,
	OrderTransactionType
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { OrderChange } from './order-change.entity';
import { TypeOrmOrderChangeRepository } from './repository/type-orm-order-change.repository';
import { MikroOrmOrderChangeRepository } from './repository/mikro-orm-order-change.repository';
import { OrderChangeAction } from '../order-change-action/order-change-action.entity';
import { OrderChangeActionService } from '../order-change-action/order-change-action.service';
import { OrderCreditLine } from '../order-credit-line/order-credit-line.entity';
import { OrderCreditLineService } from '../order-credit-line/order-credit-line.service';
import { OrderAddress } from '../order-address/order-address.entity';
import { OrderAddressService } from '../order-address/order-address.service';
import { OrderHistoryService } from '../order-history/order-history.service';
import { OrderLine } from '../order-line/order-line.entity';
import { OrderLineService } from '../order-line/order-line.service';
import { OrderShippingMethod } from '../order-shipping-method/order-shipping-method.entity';
import { OrderShippingMethodService } from '../order-shipping-method/order-shipping-method.service';
import { OrderTransaction } from '../order-transaction/order-transaction.entity';
import { OrderTransactionService } from '../order-transaction/order-transaction.service';
import { OrderTotalsService } from '../order-totals/order-totals.service';
import { TypeOrmOrderRepository } from '../order/repository/type-orm-order.repository';

/** The statuses that occupy an order's exclusivity slot. */
const NON_TERMINAL_STATUSES = [
	OrderChangeStatus.PENDING,
	OrderChangeStatus.REQUESTED,
	OrderChangeStatus.CONFIRMED
];

/**
 * The actions whose effect is applied by the package that owns the concept they touch.
 *
 * This package records the action, validates it, and applies everything that belongs to the order
 * itself. A fulfilment, a stock transfer, a promotion redemption and a received return belong to the
 * fulfilment, inventory, promotion and returns packages: applying them here would be this package
 * reaching into another domain's rows, and ignoring them silently would be worse — an operator would
 * believe a shipment had been created. They are therefore refused, with the owning package named.
 */
const DELEGATED_ACTIONS: Partial<Record<OrderChangeActionType, string>> = {
	[OrderChangeActionType.FULFILLMENT_CREATE]: '@gauzy/plugin-fulfillment',
	[OrderChangeActionType.TRANSFER_CREATE]: '@gauzy/plugin-inventory',
	[OrderChangeActionType.PROMOTION_ADD]: '@gauzy/plugin-promotion',
	[OrderChangeActionType.PROMOTION_REMOVE]: '@gauzy/plugin-promotion',
	[OrderChangeActionType.RECEIVE_RETURN_ITEM]: '@gauzy/plugin-returns'
};

/**
 * Post-placement modifications of an order.
 *
 * **The exclusivity rule** is enforced here rather than only in the database, so two concurrent requests
 * cannot both pass a read-then-write check: creating a change first asks whether a non-terminal change
 * already exists for the order, and the partial unique index in the migration is the database-side
 * expression of the same rule on the dialects that support one.
 *
 * **A change is applied atomically.** Its actions are validated as a set before any of them runs, then
 * applied in `ordering` sequence, and only then does the change move to `APPLIED` and the order's
 * version and totals move with it. A change that cannot be applied leaves the order untouched.
 */
@Injectable()
export class OrderChangeService extends TenantAwareCrudService<OrderChange> {
	constructor(
		readonly typeOrmOrderChangeRepository: TypeOrmOrderChangeRepository,
		readonly mikroOrmOrderChangeRepository: MikroOrmOrderChangeRepository,
		private readonly typeOrmOrderRepository: TypeOrmOrderRepository,
		private readonly actionService: OrderChangeActionService,
		private readonly lineService: OrderLineService,
		private readonly shippingMethodService: OrderShippingMethodService,
		private readonly addressService: OrderAddressService,
		private readonly creditLineService: OrderCreditLineService,
		private readonly transactionService: OrderTransactionService,
		private readonly historyService: OrderHistoryService,
		private readonly totalsService: OrderTotalsService
	) {
		super(typeOrmOrderChangeRepository, mikroOrmOrderChangeRepository);
	}

	/**
	 * Finds the changes of an order that still hold its exclusivity slot.
	 *
	 * @param orderId The order.
	 * @returns The non-terminal changes, which is at most one.
	 */
	public async findOpenForOrder(orderId: ID): Promise<OrderChange[]> {
		const changes = (await this.findAll({ where: { orderId } })) as IPagination<OrderChange>;

		return changes.items.filter((change: OrderChange) => NON_TERMINAL_STATUSES.includes(change.status));
	}

	/**
	 * Creates a change, or refuses when the order already has one in flight.
	 *
	 * @param entity The change, with its actions.
	 * @returns The created change, with its actions persisted in submission order.
	 */
	public async create(entity: DeepPartial<OrderChange>): Promise<OrderChange> {
		const orderId = entity.orderId as ID;
		const order = await this.typeOrmOrderRepository.findOne({ where: { id: orderId } });

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		if (order.status === OrderStatus.ARCHIVED) {
			throw new BadRequestException('ORDER_ARCHIVED: an archived order is read-only.');
		}

		const open = await this.findOpenForOrder(orderId);

		if (open.length > 0) {
			throw new BadRequestException({
				message: 'Another change is already in progress on this order.',
				code: 'ORDER_CHANGE_IN_PROGRESS',
				details: { changeId: open[0].id, status: open[0].status, requestedAt: open[0].requestedAt }
			});
		}

		const actions = (entity as { actions?: DeepPartial<OrderChangeAction>[] }).actions ?? [];

		this.validateActions(actions as OrderChangeAction[]);

		// A return, a claim, an exchange and a credit ask for a decision; a plain edit by a staff member
		// who holds the permission does not.
		const requiresApproval =
			entity.changeType !== OrderChangeType.EDIT || Boolean(entity.metadata?.['requireApproval']);

		const change = await super.create({
			...entity,
			status: requiresApproval ? OrderChangeStatus.REQUESTED : OrderChangeStatus.PENDING,
			version: Number(order.version) + 1,
			requestedAt: new Date()
		} as DeepPartial<OrderChange>);

		let ordering = 0;

		for (const action of actions) {
			await this.actionService.create({
				...action,
				changeId: change.id,
				ordering: ordering++,
				applied: false
			} as DeepPartial<OrderChangeAction>);
		}

		await this.historyService.record(orderId, 'CHANGE_REQUESTED', 'A change was requested', {
			changeId: change.id,
			changeType: change.changeType
		});

		return this.findOneByIdString(change.id, { relations: ['actions'] });
	}

	/**
	 * Applies a change.
	 *
	 * @param changeId The change.
	 * @returns The change, now `APPLIED`, and the order it moved.
	 */
	public async confirm(changeId: ID): Promise<{ change: OrderChange; order: unknown }> {
		const change = await this.findOneByIdString(changeId, { relations: ['actions'] });

		if (!change) {
			throw new NotFoundException(`ORDER_CHANGE_NOT_FOUND: no change exists with id ${changeId}.`);
		}

		if (change.status === OrderChangeStatus.APPLIED) {
			throw new BadRequestException('ORDER_CHANGE_ALREADY_APPLIED: this change has already been applied.');
		}

		if (![OrderChangeStatus.PENDING, OrderChangeStatus.REQUESTED].includes(change.status)) {
			throw new BadRequestException(
				`ORDER_CHANGE_NOT_APPLICABLE: a ${change.status} change cannot be applied.`
			);
		}

		const actions = [...(change.actions ?? [])].sort(
			(left: OrderChangeAction, right: OrderChangeAction) => left.ordering - right.ordering
		);

		for (const action of actions) {
			await this.applyAction(change, action);
			await this.actionService.update(action.id, { applied: true, appliedAt: new Date() } as any);
		}

		await this.update(change.id, {
			status: OrderChangeStatus.APPLIED,
			confirmedAt: new Date(),
			priceChange: await this.priceChangeOf(change)
		} as any);

		await this.historyService.record(change.orderId, 'CHANGE_CONFIRMED', 'A change was applied', {
			changeId: change.id,
			changeType: change.changeType
		});

		const order = await this.totalsService.recompute(change.orderId, 'CHANGE_CONFIRMED');

		return { change: await this.findOneByIdString(change.id, { relations: ['actions'] }), order };
	}

	/**
	 * Declines a change. Nothing it described is applied, and the exclusivity slot is released.
	 *
	 * @param changeId The change.
	 * @param reason Why it was declined.
	 * @returns The declined change.
	 */
	public async decline(changeId: ID, reason?: string): Promise<OrderChange> {
		const change = await this.loadChange(changeId);

		if (!NON_TERMINAL_STATUSES.includes(change.status)) {
			throw new BadRequestException(
				`ORDER_CHANGE_NOT_APPLICABLE: a ${change.status} change cannot be declined.`
			);
		}

		await this.update(change.id, {
			status: OrderChangeStatus.DECLINED,
			declinedAt: new Date(),
			metadata: { ...(change.metadata ?? {}), declineReason: reason }
		} as any);
		await this.historyService.record(change.orderId, 'CHANGE_DECLINED', 'A change was declined', {
			changeId: change.id,
			reason
		});

		return this.findOneByIdString(change.id);
	}

	/**
	 * Cancels a change that has not been applied.
	 *
	 * @param changeId The change.
	 * @param reason Why it was cancelled.
	 * @returns The cancelled change.
	 */
	public async cancel(changeId: ID, reason?: string): Promise<OrderChange> {
		const change = await this.loadChange(changeId);

		if (!NON_TERMINAL_STATUSES.includes(change.status)) {
			throw new BadRequestException(
				`ORDER_CHANGE_NOT_APPLICABLE: a ${change.status} change cannot be cancelled.`
			);
		}

		await this.update(change.id, {
			status: OrderChangeStatus.CANCELED,
			canceledAt: new Date(),
			metadata: { ...(change.metadata ?? {}), cancelReason: reason }
		} as any);
		await this.historyService.record(change.orderId, 'CHANGE_CANCELED', 'A change was cancelled', {
			changeId: change.id,
			reason
		});

		return this.findOneByIdString(change.id);
	}

	/**
	 * Cancels every change that has sat unapplied for longer than the configured window.
	 *
	 * @param staleChangeHours How long a change may sit before it is stale.
	 * @returns The ids of the changes that were cancelled.
	 */
	public async cancelStaleChanges(staleChangeHours = 24): Promise<ID[]> {
		const changes = (await this.findAll({})) as IPagination<OrderChange>;
		const cutoff = Date.now() - staleChangeHours * 60 * 60 * 1000;
		const cancelled: ID[] = [];

		for (const change of changes.items) {
			if (![OrderChangeStatus.PENDING, OrderChangeStatus.REQUESTED].includes(change.status)) {
				continue;
			}

			const requestedAt = change.requestedAt ? new Date(change.requestedAt).getTime() : 0;

			if (requestedAt > 0 && requestedAt <= cutoff) {
				await this.cancel(change.id, 'STALE_CHANGE_CLEANUP');
				cancelled.push(change.id);
			}
		}

		return cancelled;
	}

	/**
	 * Validates a change's actions as a set, before any of them runs.
	 *
	 * The order matters: a fulfilment must not reference a line that a later removal deletes, and an
	 * action this package does not own must be refused rather than skipped.
	 *
	 * @param actions The actions, in submission order.
	 */
	private validateActions(actions: readonly OrderChangeAction[]): void {
		if (actions.length === 0) {
			throw new BadRequestException('ORDER_CHANGE_EMPTY: a change needs at least one action.');
		}

		const removedReferences = new Set(
			actions
				.filter((action) => action.action === OrderChangeActionType.ITEM_REMOVE)
				.map((action) => action.referenceId)
				.filter(Boolean)
		);

		for (const action of actions) {
			const owner = DELEGATED_ACTIONS[action.action];

			if (owner) {
				throw new BadRequestException({
					message: `The ${action.action} action is applied by ${owner}, which is not installed alongside this package.`,
					code: 'ORDER_CHANGE_ACTION_NOT_SUPPORTED',
					details: { action: action.action, owner }
				});
			}

			if (
				action.action === OrderChangeActionType.FULFILLMENT_CREATE &&
				action.referenceId &&
				removedReferences.has(action.referenceId)
			) {
				throw new BadRequestException({
					message: 'A fulfilment cannot reference a line that the same change removes.',
					code: 'ORDER_CHANGE_ACTIONS_INCONSISTENT',
					details: { orderLineId: action.referenceId }
				});
			}
		}
	}

	/**
	 * Applies one action.
	 *
	 * @param change The change the action belongs to.
	 * @param action The action.
	 */
	private async applyAction(change: OrderChange, action: OrderChangeAction): Promise<void> {
		const details = (action.details ?? {}) as Record<string, any>;

		switch (action.action) {
			case OrderChangeActionType.ITEM_ADD:
				await this.lineService.create({
					orderId: change.orderId,
					productId: details['productId'],
					variantId: details['variantId'],
					sellerId: details['sellerId'],
					title: details['title'] ?? 'Item',
					sku: details['sku'],
					quantity: details['quantity'] ?? 1,
					unitPrice: details['unitPrice'] ?? 0,
					originalUnitPrice: details['unitPrice'] ?? 0,
					isTaxInclusive: details['isTaxInclusive'] ?? false,
					taxCategoryId: details['taxCategoryId'],
					position: details['position'] ?? 0,
					warehouseId: details['warehouseId'],
					note: details['note'],
					metadata: details['metadata']
				} as DeepPartial<OrderLine>);
				break;

			case OrderChangeActionType.ITEM_UPDATE: {
				const line = await this.loadLine(change.orderId, action.referenceId ?? details['orderLineId']);
				const changes: Record<string, unknown> = {};

				for (const field of ['quantity', 'unitPrice', 'note', 'warehouseId']) {
					if (details[field] !== undefined) {
						changes[field] = details[field];
					}
				}

				await this.lineService.update(line.id, changes as any);
				break;
			}

			case OrderChangeActionType.ITEM_REMOVE: {
				const line = await this.loadLine(change.orderId, action.referenceId ?? details['orderLineId']);

				if (Number(line.fulfilledQuantity) > 0) {
					throw new BadRequestException({
						message: 'A line that has been fulfilled cannot be removed.',
						code: 'ORDER_CHANGE_NOT_APPLICABLE',
						details: { orderLineId: line.id, fulfilledQuantity: line.fulfilledQuantity }
					});
				}

				await this.lineService.delete(line.id);
				break;
			}

			case OrderChangeActionType.SHIPPING_ADD:
				await this.shippingMethodService.create({
					orderId: change.orderId,
					shippingOptionId: details['shippingOptionId'],
					name: details['name'] ?? 'Shipping',
					amount: details['amount'] ?? 0,
					isTaxInclusive: details['isTaxInclusive'] ?? false,
					taxCategoryId: details['taxCategoryId'],
					data: details['data'],
					position: details['position'] ?? 0
				} as DeepPartial<OrderShippingMethod>);
				break;

			case OrderChangeActionType.SHIPPING_UPDATE: {
				const shippingMethodId = (action.referenceId ?? details['orderShippingMethodId']) as ID;
				const method = await this.shippingMethodService.findOneByWhereOptions({
					id: shippingMethodId
				} as any);

				if (!method) {
					throw new NotFoundException(`ORDER_SHIPPING_METHOD_NOT_FOUND: no method ${shippingMethodId}.`);
				}

				await this.shippingMethodService.update(method.id, {
					amount: details['amount'] ?? method.amount,
					name: details['name'] ?? method.name
				} as any);
				break;
			}

			case OrderChangeActionType.SHIPPING_REMOVE:
				await this.shippingMethodService.delete(
					(action.referenceId ?? details['orderShippingMethodId']) as ID
				);
				break;

			case OrderChangeActionType.ADDRESS_UPDATE: {
				const type = (details['type'] ?? AddressType.SHIPPING) as AddressType;
				const existing = ((await this.addressService.findAll({
					where: { orderId: change.orderId, type }
				})) as IPagination<OrderAddress>).items[0];

				if (existing) {
					await this.addressService.update(existing.id, { ...(details['address'] ?? {}) } as any);
				} else {
					await this.addressService.create({
						orderId: change.orderId,
						type,
						...(details['address'] ?? {})
					} as DeepPartial<OrderAddress>);
				}
				break;
			}

			case OrderChangeActionType.CREDIT_LINE_ADD: {
				const amount = Number(details['amount'] ?? action.amount ?? 0);
				const order = await this.typeOrmOrderRepository.findOne({ where: { id: change.orderId } });

				await this.creditLineService.create({
					orderId: change.orderId,
					version: Number(order?.version ?? 1) + 1,
					referenceType: details['referenceType'],
					referenceId: details['referenceId'],
					amount,
					currency: order?.currency,
					description: details['description']
				} as DeepPartial<OrderCreditLine>);

				// A credit settles part of the balance without money moving, so it is also a ledger row:
				// the credit total and the paid total move together, by construction rather than by
				// reconciliation.
				await this.transactionService.create({
					orderId: change.orderId,
					amount,
					currency: order?.currency,
					type: OrderTransactionType.CREDIT,
					referenceType: details['referenceType'] ?? 'credit_line',
					referenceId: details['referenceId'],
					description: details['description'] ?? 'Credit applied',
					occurredAt: new Date()
				} as DeepPartial<OrderTransaction>);
				break;
			}

			case OrderChangeActionType.UPDATE_ORDER_PROPERTIES: {
				const changes: Record<string, unknown> = {};

				for (const field of ['email', 'phone', 'locale', 'note', 'metadata']) {
					if (details[field] !== undefined) {
						changes[field] = details[field];
					}
				}

				await this.typeOrmOrderRepository.update(change.orderId, changes as any);
				break;
			}

			case OrderChangeActionType.NOTE_ADD:
				await this.historyService.record(change.orderId, 'NOTE_ADDED', details['title'] ?? 'Note added', {
					description: details['description'],
					visibleToCustomer: details['isVisibleToCustomer']
				});
				break;

			case OrderChangeActionType.ITEM_RETURN: {
				const line = await this.loadLine(change.orderId, action.referenceId ?? details['orderLineId']);

				await this.lineService.update(line.id, {
					returnRequestedQuantity:
						Number(line.returnRequestedQuantity) + Number(details['quantity'] ?? 0)
				} as any);
				break;
			}

			case OrderChangeActionType.DISMISS_ITEM_RETURN: {
				const line = await this.loadLine(change.orderId, action.referenceId ?? details['orderLineId']);

				await this.lineService.update(line.id, {
					returnDismissedQuantity:
						Number(line.returnDismissedQuantity) + Number(details['quantity'] ?? 0)
				} as any);
				break;
			}

			case OrderChangeActionType.WRITE_OFF_ITEM: {
				const line = await this.loadLine(change.orderId, action.referenceId ?? details['orderLineId']);

				await this.lineService.update(line.id, {
					writtenOffQuantity: Number(line.writtenOffQuantity) + Number(details['quantity'] ?? 0)
				} as any);
				break;
			}

			default:
				throw new BadRequestException({
					message: `The ${action.action} action has no handler in this package.`,
					code: 'ORDER_CHANGE_ACTION_NOT_SUPPORTED',
					details: { action: action.action }
				});
		}
	}

	/**
	 * The money effect of a change, taken from its actions' own amounts.
	 *
	 * @param change The change.
	 * @returns The net delta, recorded on the change so an operator can see it without replaying the
	 * actions.
	 */
	private async priceChangeOf(change: OrderChange): Promise<number> {
		const actions = (await this.actionService.findAll({
			where: { changeId: change.id }
		})) as IPagination<OrderChangeAction>;

		return actions.items.reduce(
			(total: number, action: OrderChangeAction) => total + Number(action.amount ?? 0),
			0
		);
	}

	/**
	 * Loads a change or refuses.
	 *
	 * @param changeId The change.
	 * @returns The change.
	 */
	private async loadChange(changeId: ID): Promise<OrderChange> {
		const change = await this.findOneByIdString(changeId);

		if (!change) {
			throw new NotFoundException(`ORDER_CHANGE_NOT_FOUND: no change exists with id ${changeId}.`);
		}

		return change;
	}

	/**
	 * Loads a line and refuses one that belongs to another order, so a change cannot reach across
	 * aggregates.
	 *
	 * @param orderId The order.
	 * @param lineId The line.
	 * @returns The line.
	 */
	private async loadLine(orderId: ID, lineId: ID): Promise<OrderLine> {
		if (!lineId) {
			throw new BadRequestException('ORDER_CHANGE_ACTION_INVALID: the action needs a line reference.');
		}

		const line = await this.lineService.findOneByWhereOptions({ id: lineId } as any);

		if (!line || line.orderId !== orderId) {
			throw new NotFoundException(`ORDER_LINE_NOT_FOUND: order ${orderId} has no line ${lineId}.`);
		}

		return line;
	}
}
