import { BadRequestException, HttpStatus, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { DeepPartial, In, IsNull, LessThanOrEqual, MoreThan } from 'typeorm';
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
import {
	ApiErrorCode,
	ApiException,
	TenantAwareCrudService,
	addDecimalStrings,
	matchesExpectation,
	parseEntityVersion
} from '@gauzy/core';
import { OrderChange } from './order-change.entity';
import { TypeOrmOrderChangeRepository } from './repository/type-orm-order-change.repository';
import { MikroOrmOrderChangeRepository } from './repository/mikro-orm-order-change.repository';
import { ANY_ORDER_VERSION, ORDER_CHANGE_STALE_HOURS, OrderVersionExpectation } from '../order.types';
import { OrderChangeAction } from '../order-change-action/order-change-action.entity';
import { OrderChangeActionService } from '../order-change-action/order-change-action.service';
import { OrderCreditLine } from '../order-credit-line/order-credit-line.entity';
import { OrderCreditLineService } from '../order-credit-line/order-credit-line.service';
import { OrderAddress } from '../order-address/order-address.entity';
import { OrderAddressService } from '../order-address/order-address.service';
import { OrderHistoryService } from '../order-history/order-history.service';
import { scopeOfOrderRow } from '../order-history/order-row-scope';
import { OrderLine } from '../order-line/order-line.entity';
import { OrderLineService } from '../order-line/order-line.service';
import { OrderShippingMethod } from '../order-shipping-method/order-shipping-method.entity';
import { OrderShippingMethodService } from '../order-shipping-method/order-shipping-method.service';
import { OrderTransaction } from '../order-transaction/order-transaction.entity';
import { OrderTransactionService } from '../order-transaction/order-transaction.service';
import { OrderTotalsService } from '../order-totals/order-totals.service';
import { OrderUnitOfWork, inOwnUnitOfWork } from '../order-totals/order-unit-of-work';
import { TypeOrmOrderRepository } from '../order/repository/type-orm-order.repository';

/**
 * How many stale changes one read of the staleness sweep returns, and how many one run examines.
 *
 * **The sweep read every change the installation had ever recorded, every hour.** It asked for the whole
 * `order_change` table — every tenant's, with no status and no age in the statement — and filtered for
 * the stale ones in memory, so its cost grew with the history of the table rather than with the work it
 * had to do. The statement now names what it wants: the two statuses that still hold a slot, older than
 * the window, a page at a time in id order; and a run stops after `ORDER_CHANGE_SWEEP_LIMIT` of them, so
 * an unusual backlog is worked through over a few hourly runs rather than in one run of unbounded length.
 */
export const ORDER_CHANGE_SWEEP_BATCH_SIZE = 100;

/** The most stale changes one run of the sweep examines. See {@link ORDER_CHANGE_SWEEP_BATCH_SIZE}. */
export const ORDER_CHANGE_SWEEP_LIMIT = 1000;

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
 *
 * **Every write of a change row happens inside a write of the order**, and the order's version is what
 * predicated it: a change is part of the aggregate the order's version describes, so the caller states
 * the version of the *order* it read — as an `If-Match` header, or as the `version` argument of a
 * mutation — and the statement that checks and increments that version is the order's own conditional
 * update. The change carries no version of its own: the `version` column on this row is the order
 * version the change produces, which is a different fact, and one lock per fact is the rule.
 */
@Injectable()
export class OrderChangeService extends TenantAwareCrudService<OrderChange> {
	private readonly logger = new Logger(OrderChangeService.name);

	/**
	 * Where the next run of the staleness sweep picks up, when the last one stopped at its limit.
	 *
	 * A run is bounded, and a change it cannot cancel stays in the set it reads. Were every run to start
	 * at the lowest id, a backlog of `limit` changes that fail every time — the changes of soft-deleted
	 * orders, say — would be all any run ever reached, and every stale change behind them would keep its
	 * order locked: the starvation the per-change isolation exists to end, moved one level up. So a run
	 * that stops at its limit leaves the last id it examined here, the next run reads on from it, and a
	 * run that reaches the end of the set clears it, so the one after starts over and sees again what
	 * became stale behind it in the meantime. Kept in memory on purpose: it is a position, not a fact,
	 * and a process that restarts losing it only costs one run starting from the beginning.
	 */
	private staleSweepResumeAfter: ID | undefined;

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
		private readonly totalsService: OrderTotalsService,
		/**
		 * The persistence context each change the staleness sweep cancels runs in. Optional so a service
		 * constructed by hand behaves as it always did, which is the TypeORM behaviour; the module always
		 * supplies it.
		 */
		@Optional() private readonly unitOfWork?: OrderUnitOfWork
	) {
		super(typeOrmOrderChangeRepository, mikroOrmOrderChangeRepository);
	}

	/**
	 * Writes fields onto a change under the version of the order it belongs to.
	 *
	 * A change carries no version of its own: every write to it happens inside a write of the order, and
	 * the order's version is the one a caller states and the one the conditional update checks. The
	 * change is read first because the request names it and not the order — the route takes `:id`, which
	 * is the change — so the aggregate the version belongs to is discovered here rather than in a guard.
	 *
	 * @param changeId The change.
	 * @param changes The fields to write.
	 * @param expectation The version the caller read the order at.
	 * @returns The change, as written.
	 */
	public async commitChange(
		changeId: ID,
		changes: DeepPartial<OrderChange>,
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<OrderChange> {
		const change = await this.loadChange(changeId);

		await this.writeUnderOrderVersion(change, changes, 'CHANGE_UPDATED', expectation);

		return this.findOneByIdString(change.id);
	}

	/**
	 * Writes a change's own columns under the version of the order it belongs to.
	 *
	 * The order's write is made **first**, so a caller that read an order which has moved on is refused
	 * before anything about the change is written, and it is the only version-predicated statement of
	 * the pair — a change is part of what the order's version describes, so a lock on this row would be a
	 * second answer to the question the order's version already answers.
	 *
	 * The change's own write is addressed by its id, which the tenant-aware update scopes by the caller's
	 * tenant on a request. It is **not** addressed by an object naming the change's tenancy, although that
	 * reads as the stricter form: the object form pre-reads through `findOneByWhereOptions`, which builds
	 * its tenant criteria from the current user without checking there is one — so on the staleness sweep,
	 * where there is none, it would throw before the write and no stale change could be cancelled. With no
	 * request the id is the one this call just read the row by, so it names that row and nothing else.
	 *
	 * @param change The change, already loaded.
	 * @param changes The fields to write.
	 * @param reason Why the order's version moved, recorded on the summary row.
	 * @param expectation The version the caller read the order at.
	 */
	private async writeUnderOrderVersion(
		change: OrderChange,
		changes: DeepPartial<OrderChange>,
		reason: string,
		expectation: OrderVersionExpectation
	): Promise<void> {
		await this.totalsService.recompute(change.orderId, reason, { expectation });

		await this.update(change.id, changes as any);
	}

	/**
	 * Refuses a write whose stated version the order has already moved past.
	 *
	 * The version-predicated write decides the same question again and is still the authority — the
	 * comparison and the write are one statement there, which is what makes the guarantee. What it
	 * cannot do is answer *first* when the operation has children to write: `confirm` applies every
	 * action before it reaches `recompute`, so a caller whose expectation no longer holds was answered
	 * `409` with its change already applied. Asking here, before the first action, means such a request
	 * applies nothing.
	 *
	 * What this cannot do is close the window against a writer that commits in between — nothing short
	 * of one transaction could — but a request refused for the version it stated has written nothing.
	 *
	 * @param orderId The order the write is predicated on.
	 * @param expectation What the caller stated.
	 * @throws ApiException with `ENTITY_VERSION_CONFLICT` when the order has moved on.
	 */
	private async assertOrderExpectationHolds(orderId: ID, expectation: OrderVersionExpectation): Promise<void> {
		const order = await this.typeOrmOrderRepository.findOne({ where: { id: orderId } });
		const actual = parseEntityVersion((order as { version?: unknown } | null)?.version);

		// A missing row and a row with no usable version are both left to the conditional write: it is
		// what reports a missing record, and it pins the stated version when the row carries none.
		if (!order || actual === null || matchesExpectation(expectation, actual)) {
			return;
		}

		throw new ApiException(
			HttpStatus.CONFLICT,
			ApiErrorCode.ENTITY_VERSION_CONFLICT,
			'The order changed since you read it. Read it again and reapply your change.',
			{
				expectedVersion: expectation.wildcard ? actual : expectation.versions[0],
				actualVersion: actual
			}
		);
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

		await this.historyService.record(
			orderId,
			'CHANGE_REQUESTED',
			'A change was requested',
			{ changeId: change.id, changeType: change.changeType },
			scopeOfOrderRow(change)
		);

		return this.findOneByIdString(change.id, { relations: ['actions'] });
	}

	/**
	 * Applies a change.
	 *
	 * The change's own columns are written plainly and the order's write is the version-predicated one,
	 * because the order's version is the aggregate's lock: a caller that read an order which has moved on
	 * is refused by that statement rather than by a lock on this row. The change's status is written
	 * first, so a confirmation raced by another writer fails closed — a retry is refused as an already
	 * applied change rather than re-running the actions — and the idempotency key the route requires is
	 * what makes the retry a replay of the first answer instead.
	 *
	 * @param changeId The change.
	 * @param expectation The version the caller read the order at.
	 * @returns The change, now `APPLIED`, and the order it moved.
	 */
	public async confirm(
		changeId: ID,
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<{ change: OrderChange; order: unknown }> {
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

		// Before a single action is applied, not after: the version-predicated write below is still the
		// authority, but it runs once everything has been applied, so a caller whose expectation no
		// longer holds would otherwise be refused with its change already applied.
		await this.assertOrderExpectationHolds(change.orderId, expectation);

		for (const action of actions) {
			await this.applyAction(change, action);
			await this.actionService.update(action.id, { applied: true, appliedAt: new Date() } as any);
		}

		await this.update(change.id, {
			status: OrderChangeStatus.APPLIED,
			confirmedAt: new Date(),
			priceChange: await this.priceChangeOf(change)
		} as any);

		await this.historyService.record(
			change.orderId,
			'CHANGE_CONFIRMED',
			'A change was applied',
			{ changeId: change.id, changeType: change.changeType },
			scopeOfOrderRow(change)
		);

		// The one version-predicated write of this operation, and the one statement that increments the
		// order's version. The columns the change states about the order itself ride it: a property
		// written on its own would be a second write of the same row, judged by nothing.
		const order = await this.totalsService.recompute(change.orderId, 'CHANGE_CONFIRMED', {
			expectation,
			patch: this.orderPropertiesOf(actions)
		});

		return { change: await this.findOneByIdString(change.id, { relations: ['actions'] }), order };
	}

	/**
	 * Declines a change. Nothing it described is applied, and the exclusivity slot is released.
	 *
	 * @param changeId The change.
	 * @param reason Why it was declined.
	 * @param expectation The version the caller read the order at.
	 * @returns The declined change.
	 */
	public async decline(
		changeId: ID,
		reason?: string,
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<OrderChange> {
		const change = await this.loadChange(changeId);

		if (!NON_TERMINAL_STATUSES.includes(change.status)) {
			throw new BadRequestException(
				`ORDER_CHANGE_NOT_APPLICABLE: a ${change.status} change cannot be declined.`
			);
		}

		await this.writeUnderOrderVersion(
			change,
			{
				status: OrderChangeStatus.DECLINED,
				declinedAt: new Date(),
				metadata: { ...(change.metadata ?? {}), declineReason: reason }
			},
			'CHANGE_DECLINED',
			expectation
		);
		await this.historyService.record(
			change.orderId,
			'CHANGE_DECLINED',
			'A change was declined',
			{ changeId: change.id, reason },
			scopeOfOrderRow(change)
		);

		return this.findOneByIdString(change.id);
	}

	/**
	 * Cancels a change that has not been applied.
	 *
	 * @param changeId The change.
	 * @param reason Why it was cancelled.
	 * @param expectation The version the caller read the order at.
	 * @returns The cancelled change.
	 */
	public async cancel(
		changeId: ID,
		reason?: string,
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<OrderChange> {
		const change = await this.loadChange(changeId);

		if (!NON_TERMINAL_STATUSES.includes(change.status)) {
			throw new BadRequestException(
				`ORDER_CHANGE_NOT_APPLICABLE: a ${change.status} change cannot be cancelled.`
			);
		}

		await this.writeUnderOrderVersion(
			change,
			{
				status: OrderChangeStatus.CANCELED,
				canceledAt: new Date(),
				metadata: { ...(change.metadata ?? {}), cancelReason: reason }
			},
			'CHANGE_CANCELED',
			expectation
		);
		// The entry carries the change's tenancy — which is its order's — because the staleness sweep
		// reaches this line with no request behind it, and the timeline of an order is read in the
		// order's tenant.
		await this.historyService.record(
			change.orderId,
			'CHANGE_CANCELED',
			'A change was cancelled',
			{ changeId: change.id, reason },
			scopeOfOrderRow(change)
		);

		return this.findOneByIdString(change.id);
	}

	/**
	 * Cancels every change that has sat unapplied for longer than the configured window.
	 *
	 * **This is the only thing that gives an order's exclusivity slot back.** An open change occupies
	 * it, `create` refuses a second one while it stands, and no other path closes a change nobody acted
	 * on — so the sweep is what keeps one operator's abandoned request from keeping every later change
	 * out of the order for ever. It is called by the scheduled entry that states the window's cost
	 * (`OrderChangeStalenessScheduler`), and the window itself is {@link ORDER_CHANGE_STALE_HOURS},
	 * stated once so the job and this method cannot come to disagree about it.
	 *
	 * **The age is read from `requestedAt` and falls back to `createdAt`.** `create` always states
	 * `requestedAt`, so the fallback is not a live path — but the column is nullable, and a row that
	 * reached the table by a path the write path does not guard, an import or a data fix applied by
	 * hand, would otherwise be skipped by the sweep for ever and hold its order exactly as an
	 * abandoned request does. The fallback is the second arm of the statement's own predicate.
	 *
	 * **The statement names what it wants, and a run is bounded.** Only the changes that still hold a
	 * slot and are older than the window are read, a page at a time in id order, and a run examines at
	 * most `limit` of them — see {@link ORDER_CHANGE_SWEEP_BATCH_SIZE} for what the sweep read before.
	 *
	 * **One change that cannot be cancelled does not hold up the rest.** Each cancellation runs on its
	 * own, in a persistence context of its own, and a failure is logged and passed over: a change whose
	 * order was soft-deleted is refused `ORDER_NOT_FOUND` by the recomputation, and when that refusal
	 * escaped the loop it ended the sweep — every run, every hour — so every stale change after it in the
	 * table kept its order locked for as long as that one row existed. The page is keyed on the id, so a
	 * change that failed is behind the next read rather than in front of it, and a run that stops at its
	 * limit hands the next run the id it stopped at, so a backlog of changes that fail every time cannot
	 * fill every run either (see {@link staleSweepResumeAfter}).
	 *
	 * @param staleChangeHours How long a change may sit before it is stale.
	 * @param limit The most stale changes one run examines.
	 * @param batchSize How many stale changes one read returns.
	 * @returns The ids of the changes that were cancelled.
	 */
	public async cancelStaleChanges(
		staleChangeHours = ORDER_CHANGE_STALE_HOURS,
		limit = ORDER_CHANGE_SWEEP_LIMIT,
		batchSize = ORDER_CHANGE_SWEEP_BATCH_SIZE
	): Promise<ID[]> {
		const cutoff = new Date(Date.now() - staleChangeHours * 60 * 60 * 1000);
		const cancelled: ID[] = [];
		let examined = 0;
		let after: ID | undefined = this.staleSweepResumeAfter;
		let reachedEnd = false;

		while (examined < limit) {
			const take = Math.max(1, Math.min(Math.floor(batchSize), limit - examined));
			const page = await inOwnUnitOfWork(this.unitOfWork, () => this.staleChangesAfter(cutoff, after, take));

			for (const change of page) {
				examined++;

				try {
					await inOwnUnitOfWork(this.unitOfWork, () => this.cancel(change.id, 'STALE_CHANGE_CLEANUP'));
					cancelled.push(change.id);
				} catch (error) {
					this.logger.warn(
						`The stale change ${change.id} on order ${change.orderId} could not be cancelled and is left ` +
							`for the next run: ${describe(error)}`
					);
				}
			}

			const last = page[page.length - 1]?.id;

			// A short page is the last one; a page that did not move past where it started would be read
			// again for ever, so it ends the run too.
			if (page.length < take || !last || last === after) {
				reachedEnd = true;
				break;
			}

			after = last;
		}

		// A run that stopped at its limit is resumed where it stopped; one that read to the end of the set
		// lets the next run start over.
		this.staleSweepResumeAfter = reachedEnd ? undefined : after;

		return cancelled;
	}

	/**
	 * One page of the changes the staleness sweep has to cancel.
	 *
	 * Two arms, one statement: a change asked for before the cutoff, and a change with no request stamp
	 * that was created before it. A row with neither stamp matches neither and is never swept — there is
	 * no age to judge it by, and cancelling a change on no evidence would release a slot a caller may
	 * still be using.
	 *
	 * @param cutoff The instant a change has to be older than.
	 * @param after The last id the previous page answered, when there was one.
	 * @param take The page size.
	 * @returns The page, in id order.
	 */
	private async staleChangesAfter(cutoff: Date, after: ID | undefined, take: number): Promise<OrderChange[]> {
		const open = {
			status: In([OrderChangeStatus.PENDING, OrderChangeStatus.REQUESTED]),
			...(after ? { id: MoreThan(after) } : {})
		};

		return this.find({
			where: [
				{ ...open, requestedAt: LessThanOrEqual(cutoff) },
				{ ...open, requestedAt: IsNull(), createdAt: LessThanOrEqual(cutoff) }
			],
			order: { id: 'ASC' },
			take
		} as any);
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
			// The set is checked for self-contradiction before the owner of an action is consulted: a
			// change that removes a line and fulfils the same line cannot be honoured by anybody, and
			// saying so is more use to the caller than the delegation refusal it would otherwise get.
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

			const owner = DELEGATED_ACTIONS[action.action];

			if (owner) {
				throw new BadRequestException({
					message: `The ${action.action} action is applied by ${owner}, which is not installed alongside this package.`,
					code: 'ORDER_CHANGE_ACTION_NOT_SUPPORTED',
					details: { action: action.action, owner }
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
				// the row records the movement, and the credit line below is what reduces what the
				// customer owes. The sign is the ledger's own convention — `CREDIT` is money given
				// back, never money received (doc 10 §8.6) — which is what keeps the credit counted
				// **once**: `creditTotal` is the sum of the credit lines (doc 07 §6.1 step 11) while
				// `paidTotal` sums only positive rows of the paid kinds (step 12). A positive row here
				// would be subtracted a second time by `outstandingTotal` (step 14).
				await this.transactionService.create({
					orderId: change.orderId,
					amount: -amount,
					currency: order?.currency,
					type: OrderTransactionType.CREDIT,
					referenceType: details['referenceType'] ?? 'credit_line',
					referenceId: details['referenceId'],
					description: details['description'] ?? 'Credit applied',
					occurredAt: new Date()
				} as DeepPartial<OrderTransaction>);
				break;
			}

			case OrderChangeActionType.UPDATE_ORDER_PROPERTIES:
				// Written with the totals, by the one version-predicated write of the order aggregate:
				// `orderPropertiesOf` folds every action of this kind into that write's patch.
				break;

			case OrderChangeActionType.NOTE_ADD:
				await this.historyService.record(
					change.orderId,
					'NOTE_ADDED',
					details['title'] ?? 'Note added',
					{ description: details['description'], visibleToCustomer: details['isVisibleToCustomer'] },
					scopeOfOrderRow(change)
				);
				break;

			case OrderChangeActionType.ITEM_RETURN: {
				const line = await this.loadLine(change.orderId, action.referenceId ?? details['orderLineId']);

				await this.lineService.update(line.id, {
					returnRequestedQuantity: this.movedCounter(line.returnRequestedQuantity, details['quantity'])
				} as any);
				break;
			}

			case OrderChangeActionType.DISMISS_ITEM_RETURN: {
				const line = await this.loadLine(change.orderId, action.referenceId ?? details['orderLineId']);

				await this.lineService.update(line.id, {
					returnDismissedQuantity: this.movedCounter(line.returnDismissedQuantity, details['quantity'])
				} as any);
				break;
			}

			case OrderChangeActionType.WRITE_OFF_ITEM: {
				const line = await this.loadLine(change.orderId, action.referenceId ?? details['orderLineId']);

				await this.lineService.update(line.id, {
					writtenOffQuantity: this.movedCounter(line.writtenOffQuantity, details['quantity'])
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
	 * The order's own columns a change states, folded into one patch.
	 *
	 * Only the fields a placed order may still change are read: everything else about an order is a
	 * ledger or a cache, and a change that named one of those would be this package editing a fact the
	 * writer that owns it is responsible for. Several actions of the same kind fold in application
	 * order, so the last statement of a field is the one that lands — which is what applying them in
	 * sequence would have produced.
	 *
	 * @param actions The change's actions, in application order.
	 * @returns The columns to write with the totals.
	 */
	private orderPropertiesOf(actions: readonly OrderChangeAction[]): Record<string, unknown> {
		const changes: Record<string, unknown> = {};

		for (const action of actions) {
			if (action.action !== OrderChangeActionType.UPDATE_ORDER_PROPERTIES) {
				continue;
			}

			const details = (action.details ?? {}) as Record<string, any>;

			for (const field of ['email', 'phone', 'locale', 'note', 'metadata']) {
				if (details[field] !== undefined) {
					changes[field] = details[field];
				}
			}
		}

		return changes;
	}

	/**
	 * One of an order line's quantity counters, moved by what an action states.
	 *
	 * The counters are `numeric(20,6)` decimals, and moving one by adding two doubles is the arithmetic
	 * the rest of this branch exists to keep out of quantity code: a line written off `0.1` and then
	 * dismissed `0.2` lands on `0.30000000000000004`, and the fulfilment derivation that subtracts both
	 * from the ordered quantity then tests a difference for being exactly zero — which it never is
	 * again. The addition is therefore made on the digits, and the result is handed back as the number
	 * the column's transformer takes, so nothing about the write path changes but its exactness.
	 *
	 * @param current The counter as the line holds it.
	 * @param delta The quantity the action states, which may be absent.
	 * @returns The counter after the move.
	 */
	private movedCounter(current: unknown, delta: unknown): number {
		return Number(addDecimalStrings(this.decimalOf(current), this.decimalOf(delta)));
	}

	/**
	 * The money effect of a change, taken from its actions' own amounts.
	 *
	 * The actions are summed on their digits rather than with `+`: a change made of several priced
	 * actions is exactly the case where a floating point accumulation lands a cent beside the figure an
	 * operator reconciles the change against, and `priceChange` is a money column like any other.
	 *
	 * @param change The change.
	 * @returns The net delta, recorded on the change so an operator can see it without replaying the
	 * actions.
	 */
	private async priceChangeOf(change: OrderChange): Promise<number> {
		const actions = (await this.actionService.findAll({
			where: { changeId: change.id }
		})) as IPagination<OrderChangeAction>;

		return Number(
			actions.items.reduce<string>(
				(total: string, action: OrderChangeAction) => addDecimalStrings(total, this.decimalOf(action.amount)),
				'0'
			)
		);
	}

	/**
	 * One stored figure as the decimal text it is summed on.
	 *
	 * A money or quantity column is a `numeric(20,6)` whose transformer hands the value back as a
	 * `number`, and an action's `details` carry whatever a caller wrote. Both are read here: a number is
	 * rendered in its shortest round-trip form with any exponent laid out in full — the decimal kernel
	 * refuses `'1e-7'` rather than guessing at it — and text is passed through untouched, because
	 * re-rendering digits through a double is the step that loses them. Anything that is not a figure at
	 * all is zero, which is what an absent `details.quantity` has always meant on this path.
	 *
	 * @param value The figure, as a column or a caller stated it.
	 * @returns The figure as exact decimal text.
	 */
	private decimalOf(value: unknown): string {
		const text = typeof value === 'number' ? String(value) : `${value ?? ''}`.trim();

		if (text === '' || !/^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(text)) {
			return '0';
		}

		const match = /^([+-]?)(\d*)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);

		if (!match) {
			return text;
		}

		const [, sign, whole = '', fraction = '', exponentText] = match;
		const digits = `${whole || '0'}${fraction}`;
		const point = (whole || '0').length + Number(exponentText);

		if (point <= 0) {
			return `${sign}0.${'0'.repeat(-point)}${digits}`;
		}

		if (point >= digits.length) {
			return `${sign}${digits}${'0'.repeat(point - digits.length)}`;
		}

		return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
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
	 * The read is a list query rather than a "find or fail" one: a missing row is this service's own
	 * answer to give, and the generic not-found of a lookup would leave `ORDER_LINE_NOT_FOUND` — the
	 * code the API documents for a line that is not in the order — unreachable (doc 06, 404).
	 *
	 * @param orderId The order.
	 * @param lineId The line.
	 * @returns The line.
	 */
	private async loadLine(orderId: ID, lineId: ID): Promise<OrderLine> {
		if (!lineId) {
			throw new BadRequestException('ORDER_CHANGE_ACTION_INVALID: the action needs a line reference.');
		}

		const [line] = await this.lineService.find({ where: { id: lineId } } as any);

		if (!line || line.orderId !== orderId) {
			throw new NotFoundException(`ORDER_LINE_NOT_FOUND: order ${orderId} has no line ${lineId}.`);
		}

		return line;
	}
}

/**
 * @param error The failure.
 * @returns The failure as one line, so a log line stays a line.
 */
function describe(error: unknown): string {
	return error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
}
