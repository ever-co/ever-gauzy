import { Injectable, Logger } from '@nestjs/common';
import { FindManyOptions, LessThanOrEqual } from 'typeorm';
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
	 * Expires every hold of a batch whose expiry has passed. Job body of the reservation expiry sweep.
	 *
	 * The batch is selected with a row lock where the dialect supports skipping locked rows, so two
	 * workers running the sweep concurrently cannot both claim the same hold. The update is guarded by
	 * the state, which turns a second claim into a no-op rather than a double release.
	 *
	 * @param batchSize how many holds one transaction claims; the default is the documented 500.
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
			for (const reservation of expired) {
				try {
					await this.close(reservation.id, StockReservationStatus.EXPIRED, 'EXPIRED');
					released += 1;
				} catch (error) {
					// A hold another worker closed between the read and the write is not a failure: the
					// state guard already refused the transition, which is exactly the intent.
					this.logger.debug(`Reservation ${reservation.id} was closed by another worker.`);
				}
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
	 * @param referenceType kind of the owning document.
	 * @param referenceId id of the owning document.
	 * @param expiresAt the new expiry.
	 * @returns how many holds were extended.
	 */
	public async extend(
		referenceType: StockReservationReferenceType,
		referenceId: ID,
		expiresAt: Date
	): Promise<number> {
		const active = await this.typeOrmStockReservationRepository.find({
			where: { referenceType, referenceId, status: StockReservationStatus.ACTIVE } as any
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
			where: { referenceType: from.referenceType, referenceId: from.referenceId, status: StockReservationStatus.ACTIVE } as any
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

	/** Closes a hold exactly once and writes the matching ledger row. */
	private async close(id: ID, status: StockReservationStatus, reason?: string): Promise<StockReservation> {
		return await this.typeOrmStockReservationRepository.manager.transaction(async (manager) => {
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
	 * Refuses a hold that availability cannot cover.
	 *
	 * This is the second half of the oversell guard: the level row is locked by the ledger engine, and
	 * this check reads the locked values, so a level that allows no backorder can never be driven
	 * negative by concurrent allocation.
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
