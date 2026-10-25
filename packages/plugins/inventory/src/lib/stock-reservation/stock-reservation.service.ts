import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, FindManyOptions, FindOptionsWhere, In, LessThanOrEqual, Not, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, WarehouseProductVariant } from '@gauzy/core';
import { StockMovementType, StockMovementReferenceType, StockReservationReferenceType, StockReservationStatus } from './../inventory.enums';
import { InventoryErrorCode, invariantViolation, inventoryError } from './../inventory.errors';
import { assertLocationInScope, assertVariantInScope, narrowLevelReadToTenant, requestScope } from './../inventory.scope';
import { StockLevelService } from './../stock-level/stock-level.service';
import { IStockMovementInput } from './../stock-level/stock-level.types';
import { StockReservation } from './stock-reservation.entity';
import { TypeOrmStockReservationRepository } from './repository/type-orm-stock-reservation.repository';
import { MikroOrmStockReservationRepository } from './repository/mikro-orm-stock-reservation.repository';
import { InventoryCrudService } from '../inventory-crud.service';

/** Default lifetimes, in minutes, of a hold that names no expiry of its own. */
const DEFAULT_TTL_MINUTES: Record<StockReservationReferenceType, number> = {
	[StockReservationReferenceType.CART]: 30,
	[StockReservationReferenceType.ORDER]: 10080,
	[StockReservationReferenceType.RETURN]: 20160,
	[StockReservationReferenceType.CLAIM]: 20160,
	[StockReservationReferenceType.EXCHANGE]: 20160,
	[StockReservationReferenceType.TRANSFER]: 10080,
	[StockReservationReferenceType.SUBSCRIPTION]: 4320
};

/**
 * How many holds one expiry sweep may set aside as "could not be closed" before it stops.
 *
 * The sweep leaves those holds out of every later read of the same walk, so one hold that cannot be
 * released does not stand in front of the expired holds behind it. The set is bound into that read as
 * `NOT IN (...)`, so it is capped well under every supported dialect's bound-parameter limit; a walk
 * that reaches the cap is failing systematically rather than on one bad row, and stops.
 */
export const EXPIRY_SWEEP_SKIP_LIMIT = 500;

/**
 * Whether a close was refused because the hold is no longer `ACTIVE`: another writer closed it first.
 *
 * @param error What the close threw.
 * @returns `true` for the `RESERVATION_ALREADY_CLOSED` refusal, `false` for anything else.
 */
function isAlreadyClosed(error: unknown): boolean {
	const response = (error as { getResponse?: () => unknown } | null)?.getResponse?.();

	return (response as { code?: unknown } | null)?.code === InventoryErrorCode.RESERVATION_ALREADY_CLOSED;
}

/**
 * The members of a hold that only its domain writers may move.
 *
 * A hold's quantity is counted in its level's `reservedQuantity`, its location and variant name the level it is
 * counted against, and its status says whether it is counted at all. Doc 09 §15.1 INV-03 admits only `reserve`,
 * `release`, `consume` and the expiry sweep as writers of those, because each of them writes the movement that
 * keeps the level equal to the sum of its `ACTIVE` holds. A generic update writes no movement, so a change to
 * any of these through it leaves the level counting a hold that no longer says what it counts.
 */
const HOLD_COUNTED_MEMBERS = ['quantity', 'status', 'warehouseId', 'variantId'] as const;

/**
 * Whether a stated member only restates what the hold already holds.
 *
 * The quantity is compared as a number, because a `numeric` column reads back as `"2.000000"` while a client
 * states `2`; the other members are identifiers and an enumeration, compared as text.
 */
function restatesHoldMember(member: (typeof HOLD_COUNTED_MEMBERS)[number], stored: unknown, stated: unknown): boolean {
	if (stated === null) {
		return stored === null || stored === undefined;
	}
	if (member === 'quantity') {
		const wanted = Number(stated);

		return Number.isFinite(wanted) && wanted === Number(stored);
	}

	return String(stated) === String(stored ?? '');
}

/**
 * The movement kind a consumed hold produces.
 *
 * Consuming a hold is the moment the held units physically leave, so the row it writes is a
 * *removal* and not a release: the document that caused it is already recorded in the movement's own
 * `referenceType`, and what the `type` column says is what happened to the stock. The ledger's
 * vocabulary has one word for units leaving because they were sold and fulfilled — `SALE` — and one
 * for units leaving for another location of the same network, which is what a transfer hold becomes.
 * Everything else a hold can belong to ends with the units in a customer's hands, so `SALE` is the
 * honest reading rather than a default.
 *
 * @param type The kind of document the hold belongs to.
 * @returns The movement type the consumption is written under.
 */
function toConsumptionType(type: StockReservationReferenceType): StockMovementType {
	return type === StockReservationReferenceType.TRANSFER
		? StockMovementType.TRANSFER_OUT
		: StockMovementType.SALE;
}

/** The reservation reference kind a movement’s provenance string maps onto. */
function toMovementReference(type: StockReservationReferenceType): StockMovementReferenceType {
	switch (type) {
		case StockReservationReferenceType.CART:
			return StockMovementReferenceType.CART;
		case StockReservationReferenceType.ORDER:
			return StockMovementReferenceType.ORDER;
		case StockReservationReferenceType.RETURN:
			return StockMovementReferenceType.RETURN;
		case StockReservationReferenceType.CLAIM:
			return StockMovementReferenceType.CLAIM;
		case StockReservationReferenceType.EXCHANGE:
			return StockMovementReferenceType.EXCHANGE;
		case StockReservationReferenceType.TRANSFER:
			return StockMovementReferenceType.TRANSFER;
		default:
			return StockMovementReferenceType.ORDER;
	}
}

/**
 * Holds stock, releases it, and consumes it.
 *
 * Every transition goes through the ledger engine, so the level row’s reserved quantity and the
 * `RESERVATION` / `RELEASE` rows that explain it are written in one transaction. A hold therefore
 * cannot exist without the ledger knowing, and a hold cannot be released twice.
 */
@Injectable()
export class StockReservationService extends InventoryCrudService<StockReservation> {
	private readonly logger = new Logger(StockReservationService.name);

	constructor(
		readonly typeOrmStockReservationRepository: TypeOrmStockReservationRepository,
		readonly mikroOrmStockReservationRepository: MikroOrmStockReservationRepository,
		private readonly stockLevelService: StockLevelService
	) {
		super(typeOrmStockReservationRepository, mikroOrmStockReservationRepository);
	}

	/**
	 * Holds a quantity at one location.
	 *
	 * The level row is locked by the ledger engine before the hold is written, which is what makes a
	 * concurrent allocation safe: two carts competing for the last unit are serialised on the row,
	 * the second one sees the first one’s reservation, and it is refused rather than oversold.
	 *
	 * **The availability read below is a fast-fail, and the authoritative check is the engine’s.** This
	 * method reads the level before the transaction opens, so the values it decides on are values a
	 * competing writer may move before the row lock is taken. That is fine for the refusals it produces
	 * — a hold the level plainly cannot cover is worth refusing without opening a transaction — but it
	 * cannot be the guarantee. The guarantee is `respectSafetyStock` on the movement: it makes the
	 * engine evaluate the same rule against the values it read *under* the lock, beside every other
	 * invariant, so two holds racing for the last sellable unit are serialised on the row and the second
	 * one is refused. Without it the only rule running under the lock asked whether the holds fit inside
	 * the on-hand quantity, which says nothing about the floor a count is protected by, and the buffer
	 * was sold through with nobody told.
	 *
	 * The hold row and the movement that explains it are **one write**: the reservation is created
	 * inside the transaction that moves the level, so a refusal from the engine — a hold the level may
	 * not carry, a contended row, a movement that cannot be written — rolls the hold back with it. A
	 * hold left behind by a refused write would understate the level’s availability for as long as it
	 * existed and would be counted by a reconciliation that expects every `ACTIVE` row to be a held
	 * unit, which is what INV-03 forbids.
	 *
	 * @param input the quantity to hold, the policy for this call and the document it belongs to.
	 * @returns the persisted hold, with the level row it was counted against.
	 */
	public async reserve(input: {
		variantId: ID;
		productId: ID;
		warehouseId: ID;
		quantity: number;
		referenceType: StockReservationReferenceType;
		referenceId: ID;
		lineId?: ID;
		expiresAt?: Date;
		isBackorder?: boolean;
		expectedAt?: Date;
		allowBackorder?: boolean;
		binId?: ID;
	}): Promise<StockReservation> {
		const quantity = Number(input.quantity);
		if (!Number.isFinite(quantity) || quantity <= 0) {
			throw inventoryError(InventoryErrorCode.INVARIANT_VIOLATION, 'A hold must be a positive quantity.', {
				badRequest: true,
				details: { requested: input.quantity }
			});
		}

		// The location and the variant are the caller's to hold before anything is read about them: a hold
		// that named another tenant's pair used to read that tenant's level, pass the availability check
		// against it and reserve its units (review R2-01). Both are answered as not existing.
		const manager = this.typeOrmStockReservationRepository.manager;
		await assertLocationInScope(manager, input.warehouseId);
		await assertVariantInScope(manager, input.variantId);

		// The caller may tighten the level’s backorder policy for this call, never widen it (review R2-02):
		// the GraphQL input carried `allowBackorder` straight here, and `true` let a hold past what a
		// no-backorder level holds — a million units against ten — where the same request over REST (whose
		// DTO has no such member) was refused. Whether a location may sell what it does not hold is the
		// level’s own setting; a caller stating `true` is answered by that setting, and a caller stating
		// `false` is held to on-hand even where the level would allow more.
		const allowBackorder = input.allowBackorder === false ? false : undefined;

		const level = await this.findLevel(input.warehouseId, input.variantId);
		this.assertAvailable(level, quantity, allowBackorder);

		return await this.typeOrmStockReservationRepository.manager.transaction(async (manager) => {
			const reservation = manager.create(StockReservation, {
				variantId: input.variantId,
				warehouseId: input.warehouseId,
				warehouseProductVariantId: level?.id,
				quantity,
				status: StockReservationStatus.ACTIVE,
				referenceType: input.referenceType,
				referenceId: input.referenceId,
				lineId: input.lineId,
				expiresAt: input.expiresAt ?? this.resolveExpiry(input.referenceType),
				isBackorder: !!input.isBackorder,
				expectedAt: input.expectedAt,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as Partial<StockReservation>);
			const persisted = await manager.save(StockReservation, reservation);

			await this.stockLevelService.applyMovement(
				{
					warehouseId: input.warehouseId,
					variantId: input.variantId,
					productId: input.productId,
					binId: input.binId,
					type: StockMovementType.RESERVATION,
					quantityDelta: 0,
					reservedDelta: quantity,
					referenceType: toMovementReference(input.referenceType),
					referenceId: input.referenceId,
					levelId: level?.id,
					// A hold is a new demand on availability, so the unsellable buffer is a floor it may not
					// consume — and that rule has to be evaluated where the level row is locked rather than
					// against the pre-flight read above, which a competing writer can overtake.
					respectSafetyStock: true,
					// A caller that tightened the policy for this call carries that to the rule evaluated under
					// the lock; otherwise the rule reads the level's own column. A caller can no longer widen
					// it here (R2-02), so the override is only ever `false`.
					...(allowBackorder === undefined ? {} : { allowBackorder })
				} as IStockMovementInput,
				manager
			);

			return persisted;
		});
	}

	/**
	 * Releases a hold without the stock leaving: a cart edit, an abandoned cart, a cancelled order.
	 *
	 * @param id the hold to close.
	 * @param reason machine-readable reason recorded on the ledger row.
	 */
	public async release(id: ID, reason?: string): Promise<StockReservation> {
		return await this.close(id, StockReservationStatus.RELEASED, reason);
	}

	/**
	 * Consumes a hold: the held units leave, and the hold closes with them.
	 *
	 * **This is the third transition the class was written for and the one that was never written.**
	 * `CONSUMED` is declared in the status vocabulary as "the stock actually left; a matching movement
	 * was written in the same transaction", `consumedAt` is a column of the row, and the mutation was
	 * declared in the composed GraphQL schema — with nothing bound to it, so a client that called it
	 * was answered `Cannot return null for non-nullable field Mutation.consumeStockReservation` after
	 * the document had already passed validation.
	 *
	 * It is not a release. A release gives the reserved quantity back to availability and leaves the
	 * on-hand quantity where it was; a consumption removes **both**, in one movement, because the units
	 * are gone and the hold on them is gone with them. Writing it as a release followed by a sale would
	 * be two movements and a window in between where the units are unheld and still on the shelf, which
	 * is exactly the window a hold exists to close.
	 *
	 * The movement and the status are one write, for the same reason every other transition here is:
	 * a hold that reads `CONSUMED` while the level still counts its units would understate nothing and
	 * oversell everything.
	 *
	 * @param id The hold to consume.
	 * @param reason Machine-readable reason recorded on the ledger row.
	 * @returns The hold, closed.
	 * @throws ApiException with `RESERVATION_NOT_FOUND` when no hold carries the id, or with
	 * `RESERVATION_ALREADY_CLOSED` when it is not `ACTIVE`.
	 */
	public async consume(id: ID, reason?: string): Promise<StockReservation> {
		return await this.typeOrmStockReservationRepository.manager.transaction(async (manager) => {
			const reservation = await this.requireActive(manager, id);
			const quantity = Number(reservation.quantity);

			reservation.status = StockReservationStatus.CONSUMED;
			reservation.consumedAt = new Date();
			const saved = await manager.save(StockReservation, reservation);

			await this.stockLevelService.applyMovement(
				{
					warehouseId: reservation.warehouseId,
					variantId: reservation.variantId,
					type: toConsumptionType(reservation.referenceType),
					quantityDelta: -quantity,
					reservedDelta: -quantity,
					referenceType: toMovementReference(reservation.referenceType),
					referenceId: reservation.referenceId,
					reason,
					levelId: reservation.warehouseProductVariantId
				},
				manager
			);

			return saved;
		});
	}

	/**
	 * Expires every hold of a batch whose expiry has passed. Job body of the reservation expiry sweep.
	 *
	 * **Correctness is the state guard, not a row lock.** The batch is an ordinary read — no dialect the
	 * platform runs on is asked for `FOR UPDATE SKIP LOCKED` here, and the docstring used to claim one
	 * that the statement below never took. It does not need one: `close` refuses a hold that is not
	 * `ACTIVE`, inside the transaction that would release it, so a hold another worker has already
	 * closed is a refusal rather than a second release, and two sweeps running at once cannot double
	 * count.
	 *
	 * **What the missing lock did break was the loop, and that is fixed here.** The walk used to stop
	 * only when a batch came back short, and a row that failed to close stayed `ACTIVE` and expired — so
	 * two workers reading the same batch, or one row that could not be released for a real reason, made
	 * every batch come back full of rows the sweep had already tried and the walk spent its whole budget
	 * re-reading them: two hundred batches of five hundred `findOne`-plus-transaction round trips, with
	 * `released` reported as zero.
	 *
	 * **A hold the walk could not close is set aside, not re-read and not waited behind.** Its id is left
	 * out of every later read of the same walk, so the next batch is made of holds the walk has not tried
	 * yet. Stopping on the first batch that closed nothing instead would let one hold that cannot be
	 * released — ordered first, because it expired first — stand in front of every expired hold behind it,
	 * on every sweep, for as long as it keeps failing. A set-aside hold is still `ACTIVE` and expired, so
	 * the next sweep tries it again. The set is capped at {@link EXPIRY_SWEEP_SKIP_LIMIT}: a walk that
	 * reaches the cap is failing systematically rather than on one bad row, and stops.
	 *
	 * **The batch is read in the scope the close runs in.** A close loads its hold inside the request's tenant and
	 * organization, so a batch read by the tenant alone could be made entirely of another organization's holds: an
	 * operator's sweep then closed none of them and left its own organization's expired holds reserved while
	 * answering success. The worker's sweep has no request and still reads every tenant.
	 *
	 * @param batchSize how many holds one pass claims; the default is the documented 500.
	 * @param maxBatches how many passes one sweep walks at most.
	 * @returns how many holds were expired, and how many batches were walked.
	 */
	public async releaseExpired(batchSize = 500, maxBatches = 200): Promise<{ released: number; batches: number }> {
		const scope = requestScope();
		// The holds this walk tried and could not close. They stay `ACTIVE` and expired, so every later
		// read of the walk leaves them out: otherwise they would come back first in each batch.
		const skipped: ID[] = [];
		let released = 0;
		let batches = 0;

		while (batches < maxBatches) {
			const expired = await this.typeOrmStockReservationRepository.find({
				where: {
					status: StockReservationStatus.ACTIVE,
					expiresAt: LessThanOrEqual(new Date()),
					...(skipped.length ? { id: Not(In(skipped)) } : {}),
					...scope
				} as any,
				order: { expiresAt: 'ASC' } as any,
				take: batchSize
			});

			if (!expired.length) {
				break;
			}

			batches += 1;

			for (const reservation of expired) {
				try {
					await this.close(reservation.id, StockReservationStatus.EXPIRED, 'EXPIRED');
					released += 1;
				} catch (error) {
					// A hold another worker closed between the read and the write is not a failure: the
					// state guard already refused the transition, which is exactly the intent. It is no
					// longer `ACTIVE`, so no later read returns it, and counting it as set aside would let
					// two overlapping sweeps push each other into the limit below while both make progress.
					if (isAlreadyClosed(error)) {
						continue;
					}

					// A hold that failed for any other reason is not a failure of the sweep either; it is
					// set aside for the rest of this walk and tried again by the next sweep.
					skipped.push(reservation.id);
					this.logger.debug(
						`Reservation ${reservation.id} was not expired by this sweep: ${
							(error as Error)?.message ?? error
						}`
					);
				}
			}

			// A walk that has set this many holds aside is failing systematically, not on one bad row,
			// and the set is bound into the next read: stopping keeps both the work and the statement
			// bounded.
			if (skipped.length >= EXPIRY_SWEEP_SKIP_LIMIT) {
				break;
			}

			if (expired.length < batchSize) {
				break;
			}
		}

		if (skipped.length) {
			this.logger.warn(
				`The reservation expiry sweep could not close ${skipped.length} expired hold(s)${
					skipped.length >= EXPIRY_SWEEP_SKIP_LIMIT ? ' and stopped at its limit' : ''
				}; they are left for the next sweep.`
			);
		}

		return { released, batches };
	}

	/**
	 * Pushes the expiry of every active hold of a document.
	 *
	 * The read is narrowed to the tenant and organization the request runs in, exactly as the expiry sweep's
	 * and every close's are: a document id is not a secret, but a hold of another tenant (or of another
	 * organization of the caller's tenant) is not a hold this caller may push. A caller with no tenant — a
	 * worker, a migration, a system context — is not narrowed, which is how every other read in this package
	 * treats one.
	 *
	 * The kind of document is a narrowing rather than a requirement. A document id identifies the
	 * document; stating the kind as well narrows the holds to the ones taken under it, and stating
	 * nothing means every active hold of that document — which is what the operator-facing route asks
	 * for, and what it could never get while it was passing the document id as the kind.
	 *
	 * @param referenceType kind of the owning document, when the caller narrows it to one.
	 * @param referenceId id of the owning document.
	 * @param expiresAt the new expiry.
	 * @returns how many holds were extended.
	 */
	public async extend(
		referenceType: StockReservationReferenceType | undefined,
		referenceId: ID,
		expiresAt: Date
	): Promise<number> {
		const active = await this.typeOrmStockReservationRepository.find({
			where: {
				...(referenceType ? { referenceType } : {}),
				referenceId,
				status: StockReservationStatus.ACTIVE,
				...requestScope()
			} as any
		});
		for (const reservation of active) {
			reservation.expiresAt = expiresAt;
		}
		await this.typeOrmStockReservationRepository.save(active);
		return active.length;
	}

	/**
	 * Re-points holds from one owner to another without changing quantities, which is how a cart’s
	 * holds become an order’s holds at placement.
	 *
	 * The read is narrowed to the tenant and organization the request runs in, for the same reason
	 * `extend`'s is: a hold of another tenant or organization is not a hold this caller may re-point.
	 *
	 * @param from the document the holds belong to today.
	 * @param to the document they will belong to.
	 * @param lineMap the line ids keyed by the line id they replace.
	 * @returns how many holds were re-pointed.
	 */
	public async reassign(
		from: { referenceType: StockReservationReferenceType; referenceId: ID },
		to: { referenceType: StockReservationReferenceType; referenceId: ID },
		lineMap: Record<string, string> = {}
	): Promise<number> {
		const active = await this.typeOrmStockReservationRepository.find({
			where: {
				referenceType: from.referenceType,
				referenceId: from.referenceId,
				status: StockReservationStatus.ACTIVE,
				...requestScope()
			} as any
		});
		for (const reservation of active) {
			reservation.referenceType = to.referenceType;
			reservation.referenceId = to.referenceId;
			if (reservation.lineId && lineMap[reservation.lineId]) {
				reservation.lineId = lineMap[reservation.lineId];
			}
		}
		await this.typeOrmStockReservationRepository.save(active);
		return active.length;
	}

	/**
	 * Changes the descriptive members of a hold, refusing a change to what the level counts it by.
	 *
	 * `POST /stock-reservations/:id` validates a body that declares the quantity, the status and the location —
	 * the DTO is the create DTO made partial — and the route's own summary says "the quantity and the location
	 * are not among them". Before this, they were: the generic update wrote all three onto a live hold with no
	 * level write and no movement, so the level's `reservedQuantity` went on counting the old quantity at the
	 * old location (handover 2026-09-20 §7.65 item 23 (a)). The refusal is made here, below the route, so every
	 * caller of the generic update is held to it; the route, its DTO and its other members are unchanged.
	 *
	 * A member that restates the value the row already holds is not a change and is accepted, so a client that
	 * sends the whole hold back with its expiry edited is not refused for the members it did not touch.
	 *
	 * @param id The hold, or the conditions that select the holds to change.
	 * @param partialEntity The members to change.
	 * @returns The update result, as the base class answers it.
	 * @throws ConflictException with `STOCK_INVARIANT_VIOLATION` (invariant `INV-03`) when the change would move a
	 * hold's quantity, status, location or variant.
	 */
	public async update(
		id: ID | FindOptionsWhere<StockReservation>,
		partialEntity: QueryDeepPartialEntity<StockReservation>
	): Promise<StockReservation | UpdateResult> {
		const patch = (partialEntity ?? {}) as Record<string, unknown>;
		const stated = HOLD_COUNTED_MEMBERS.filter((member) => patch[member] !== undefined);

		if (stated.length > 0) {
			const current =
				typeof id === 'string' ? [await this.findOneByIdString(id)] : await this.find({ where: id });

			for (const reservation of current) {
				const moved = stated.filter(
					(member) => !restatesHoldMember(member, (reservation as any)[member], patch[member])
				);

				if (moved.length > 0) {
					throw invariantViolation(
						'INV-03',
						`A hold's ${moved.join(', ')} cannot be changed by an update: the level counts the hold by them, and ` +
							`only reserve, release, consume and the expiry sweep write the movement that keeps that count true. ` +
							`Release the hold and place the one you need instead.`,
						{ reservationId: reservation.id, fields: moved }
					);
				}
			}
		}

		return super.update(id as any, partialEntity);
	}

	/** Lists holds with the filters the resource exposes. */
	public async findReservations(filter?: FindManyOptions<StockReservation>): Promise<IPagination<StockReservation>> {
		return await this.paginate(filter ?? {});
	}

	/** Sums the active holds of one level; the value the reconciliation re-derives the level from. */
	public async sumActiveForLevel(variantId: ID, warehouseId: ID): Promise<number> {
		const raw = await this.typeOrmStockReservationRepository
			.createQueryBuilder('reservation')
			.select('COALESCE(SUM(reservation.quantity), 0)', 'total')
			.where('reservation.variantId = :variantId', { variantId })
			.andWhere('reservation.warehouseId = :warehouseId', { warehouseId })
			.andWhere('reservation.status = :status', { status: StockReservationStatus.ACTIVE })
			.getRawOne();
		return Number(raw?.total ?? 0);
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/**
	 * Loads a hold and refuses one that has already been closed.
	 *
	 * The guard is inside the transaction that would close it, which is what makes a second closer a
	 * refusal rather than a second credit — and it is stated once because both closing paths, the
	 * release and the consumption, need exactly the same one.
	 *
	 * The hold is loaded inside the request's tenant and organization: a hold of another tenant is a hold
	 * that does not exist for this caller, not one it may consume or release (review R2-01). The expiry
	 * sweep the worker runs has no request and is not narrowed, so it still closes every tenant's holds.
	 *
	 * @param manager The transaction the close runs in.
	 * @param id The hold.
	 * @returns The hold, `ACTIVE`.
	 * @throws ApiException with `RESERVATION_NOT_FOUND` or `RESERVATION_ALREADY_CLOSED`.
	 */
	private async requireActive(manager: EntityManager, id: ID): Promise<StockReservation> {
		const reservation = await manager.findOne(StockReservation, { where: { id, ...requestScope() } });

		if (!reservation) {
			throw inventoryError(InventoryErrorCode.RESERVATION_NOT_FOUND, 'The reservation does not exist.', {
				notFound: true,
				details: { reservationId: id }
			});
		}
		if (reservation.status !== StockReservationStatus.ACTIVE) {
			throw inventoryError(
				InventoryErrorCode.RESERVATION_ALREADY_CLOSED,
				`The reservation is already ${reservation.status} and can only be closed once.`,
				{ details: { reservationId: id, status: reservation.status } }
			);
		}

		return reservation;
	}

	/** Closes a hold exactly once and writes the matching ledger row. */
	private async close(id: ID, status: StockReservationStatus, reason?: string): Promise<StockReservation> {
		return await this.typeOrmStockReservationRepository.manager.transaction(async (manager) => {
			const reservation = await this.requireActive(manager, id);

			reservation.status = status;
			reservation.releasedAt = new Date();
			const saved = await manager.save(StockReservation, reservation);

			await this.stockLevelService.applyMovement(
				{
					warehouseId: reservation.warehouseId,
					variantId: reservation.variantId,
					type: StockMovementType.RELEASE,
					quantityDelta: 0,
					reservedDelta: -Number(reservation.quantity),
					referenceType: toMovementReference(reservation.referenceType),
					referenceId: reservation.referenceId,
					reason,
					levelId: reservation.warehouseProductVariantId
				},
				manager
			);

			return saved;
		});
	}

	/**
	 * Resolves the level row of a location and variant pair, if the variant is stocked there.
	 *
	 * Narrowed to the request's tenant like every other level read of this package, so the pre-flight
	 * availability check can only ever be measured against the caller's own stock.
	 */
	private async findLevel(warehouseId: ID, variantId: ID): Promise<WarehouseProductVariant | null> {
		const query = this.typeOrmStockReservationRepository.manager
			.createQueryBuilder(WarehouseProductVariant, 'level')
			.innerJoin('level.warehouseProduct', 'aggregate')
			.where('aggregate.warehouseId = :warehouseId', { warehouseId })
			.andWhere('level.variantId = :variantId', { variantId });
		narrowLevelReadToTenant(query, RequestContext.currentTenantId());

		return await query.getOne();
	}

	/**
	 * Refuses a hold that availability cannot cover, before a transaction is opened for it.
	 *
	 * **This is the fast half of the oversell guard, not the authoritative one.** It reads the level
	 * outside the transaction, so the numbers it decides on are numbers a competing writer may move
	 * before the row lock is taken; it exists so a hold the level plainly cannot cover is refused
	 * cheaply, with the two quantities that decided it. The half that cannot be overtaken is the ledger
	 * engine's own rule, which `reserve` asks for with `respectSafetyStock` and which reads the values
	 * under the lock.
	 */
	private assertAvailable(level: WarehouseProductVariant | null, quantity: number, allowBackorder?: boolean): void {
		if (!level) {
			// The variant has never been stocked at this location, so there is no level whose policy could
			// permit a backorder, and a caller cannot grant one itself (R2-02).
			throw inventoryError(
				InventoryErrorCode.INSUFFICIENT_AVAILABLE,
				'The variant is not stocked at this location, so nothing can be held there.',
				{ details: { requested: quantity, available: 0 } }
			);
		}

		if (level.isUnlimited) {
			return;
		}

		const available = Number(level.quantity ?? 0) - Number(level.reservedQuantity ?? 0) - Number(level.safetyStock ?? 0);
		if (available >= quantity) {
			return;
		}

		const backorderAllowed = allowBackorder ?? !!level.allowBackorder;
		if (backorderAllowed) {
			const limit = level.backorderLimit === null || level.backorderLimit === undefined
				? undefined
				: Number(level.backorderLimit);
			const oversell = quantity - available;
			if (limit === undefined || oversell <= limit) {
				return;
			}
			throw invariantViolation('INV-07', 'The hold would exceed the level’s backorder limit.', {
				requested: quantity,
				available,
				backorderLimit: limit
			});
		}

		throw inventoryError(
			InventoryErrorCode.INSUFFICIENT_AVAILABLE,
			'Availability at this location does not cover the requested hold.',
			{ details: { requested: quantity, available } }
		);
	}

	/** Derives the expiry of a hold from its kind, when the caller named none. */
	private resolveExpiry(referenceType: StockReservationReferenceType): Date {
		const minutes = DEFAULT_TTL_MINUTES[referenceType] ?? 30;
		return new Date(Date.now() + minutes * 60 * 1000);
	}
}
