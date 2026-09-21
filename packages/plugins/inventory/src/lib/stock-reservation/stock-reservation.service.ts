import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, FindManyOptions, LessThanOrEqual } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService, WarehouseProductVariant } from '@gauzy/core';
import { StockMovementType, StockMovementReferenceType, StockReservationReferenceType, StockReservationStatus } from './../inventory.enums';
import { InventoryErrorCode, invariantViolation, inventoryError } from './../inventory.errors';
import { StockLevelService } from './../stock-level/stock-level.service';
import { IStockMovementInput } from './../stock-level/stock-level.types';
import { StockReservation } from './stock-reservation.entity';
import { TypeOrmStockReservationRepository } from './repository/type-orm-stock-reservation.repository';
import { MikroOrmStockReservationRepository } from './repository/mikro-orm-stock-reservation.repository';

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
export class StockReservationService extends TenantAwareCrudService<StockReservation> {
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

		const level = await this.findLevel(input.warehouseId, input.variantId);
		this.assertAvailable(level, quantity, input.allowBackorder);

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
					// The caller's policy for this call travels with the movement. The level's own column is
					// what the hold rule reads when the caller states nothing; when the caller states the
					// policy the demand is allowed under, that is what the rule measures it against — which is
					// the whole point of the per-call override, and the case it exists for is a demand past
					// what the level currently holds.
					...(input.allowBackorder === undefined ? {} : { allowBackorder: input.allowBackorder })
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
	 * `released` reported as zero. The walk now also stops when a batch closed nothing, because a batch
	 * that produced no progress will produce none on the next pass either, and the rows it could not
	 * close are named in the log rather than silently retried.
	 *
	 * @param batchSize how many holds one pass claims; the default is the documented 500.
	 * @param maxBatches how many passes one sweep walks at most.
	 * @returns how many holds were expired, and how many batches were walked.
	 */
	public async releaseExpired(batchSize = 500, maxBatches = 200): Promise<{ released: number; batches: number }> {
		const tenantId = RequestContext.currentTenantId();
		let released = 0;
		let batches = 0;

		while (batches < maxBatches) {
			const expired = await this.typeOrmStockReservationRepository.find({
				where: {
					status: StockReservationStatus.ACTIVE,
					expiresAt: LessThanOrEqual(new Date()),
					...(tenantId ? { tenantId } : {})
				} as any,
				order: { expiresAt: 'ASC' } as any,
				take: batchSize
			});

			if (!expired.length) {
				break;
			}

			batches += 1;
			let closed = 0;

			for (const reservation of expired) {
				try {
					await this.close(reservation.id, StockReservationStatus.EXPIRED, 'EXPIRED');
					released += 1;
					closed += 1;
				} catch (error) {
					// A hold another worker closed between the read and the write is not a failure: the
					// state guard already refused the transition, which is exactly the intent. A hold that
					// failed for any other reason is not a failure of the sweep either, but it is a row the
					// next pass would read again, which is what the progress check below is about.
					this.logger.debug(
						`Reservation ${reservation.id} was not expired by this sweep: ${
							(error as Error)?.message ?? error
						}`
					);
				}
			}

			// A pass that closed nothing has made no progress, and the rows it read are exactly the rows
			// the next read would return. Stopping is the difference between reporting "nothing could be
			// expired" once and spending the whole batch budget discovering it two hundred times.
			if (!closed) {
				this.logger.warn(
					`The reservation expiry sweep read ${expired.length} expired hold(s) and could close none of them; the sweep stops rather than re-reading them.`
				);
				break;
			}

			if (expired.length < batchSize) {
				break;
			}
		}

		return { released, batches };
	}

	/**
	 * Pushes the expiry of every active hold of a document.
	 *
	 * The read is narrowed to the tenant the request runs in, exactly as the expiry sweep's is: a
	 * document id is not a secret, but a hold of another tenant is not a hold this caller may push. A
	 * caller with no tenant — a worker, a migration, a system context — is not narrowed, which is how
	 * every other read in this package treats one.
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
		const tenantId = RequestContext.currentTenantId();
		const active = await this.typeOrmStockReservationRepository.find({
			where: {
				...(referenceType ? { referenceType } : {}),
				referenceId,
				status: StockReservationStatus.ACTIVE,
				...(tenantId ? { tenantId } : {})
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
	 * The read is narrowed to the tenant the request runs in, for the same reason `extend`'s is: a hold
	 * of another tenant is not a hold this caller may re-point.
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
		const tenantId = RequestContext.currentTenantId();
		const active = await this.typeOrmStockReservationRepository.find({
			where: {
				referenceType: from.referenceType,
				referenceId: from.referenceId,
				status: StockReservationStatus.ACTIVE,
				...(tenantId ? { tenantId } : {})
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
	 * @param manager The transaction the close runs in.
	 * @param id The hold.
	 * @returns The hold, `ACTIVE`.
	 * @throws ApiException with `RESERVATION_NOT_FOUND` or `RESERVATION_ALREADY_CLOSED`.
	 */
	private async requireActive(manager: EntityManager, id: ID): Promise<StockReservation> {
		const reservation = await manager.findOne(StockReservation, { where: { id } });

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

	/** Resolves the level row of a location and variant pair, if the variant is stocked there. */
	private async findLevel(warehouseId: ID, variantId: ID): Promise<WarehouseProductVariant | null> {
		return await this.typeOrmStockReservationRepository.manager
			.createQueryBuilder(WarehouseProductVariant, 'level')
			.innerJoin('level.warehouseProduct', 'aggregate')
			.where('aggregate.warehouseId = :warehouseId', { warehouseId })
			.andWhere('level.variantId = :variantId', { variantId })
			.getOne();
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
			// The variant has never been stocked at this location. That is a backorder by definition, and
			// it is allowed only when the caller says the policy permits it.
			if (allowBackorder) {
				return;
			}
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
