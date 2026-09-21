/**
 * The ledger as a seam: bin contents read from the movements recorded against them, the home bin of
 * a variant, and every physical move a package that does not own stock asks for.
 *
 * The class owns no table, adds no column and writes no quantity of its own. Everything it answers is
 * composed from what this package already records, and everything it writes goes through
 * `StockLevelService.applyMovement` — the one write path into stock — so the ledger’s invariant (the
 * sum of a level’s movements is the level’s quantity) holds for a movement written here exactly as it
 * holds for a dispatch, a correction or a count.
 *
 * **Where each answer comes from.**
 *
 * - A bin’s contents are the sum of the `stock_movement` rows recorded against that bin and variant,
 *   grouped in the database. Nothing is stored on a bin: two writers of one level is how a level
 *   drifts, and the physical address of a movement is a column of the ledger row itself. A pair whose
 *   movements net to zero is reported at zero — the ledger recorded it, and a count compares a level’s
 *   claim against it — while a pair the ledger holds no movement for is absent rather than reported as
 *   a zero.
 * - What the level rows *claim* sits in a set of bins is read from the level rows that name one of
 *   them as their home bin, with the quantity the level holds at its location. That is the comparison
 *   a count is about: the ledger says where the units were recorded moving, the level says where they
 *   are kept, and a run that finds them disagreeing reports the difference.
 * - The home bin of a variant at a location is the level row’s own home-bin column, with the quantity
 *   the level holds there. It is read rather than derived: the column is the record of the operator’s
 *   decision about where the stock lives, and the movement history is not a substitute for it. A
 *   variant that is not stocked at the location has no home bin at all, which is a different answer
 *   from a level that names none.
 *
 * **What a movement does to the level.** The caller states a signed quantity and a kind, and the
 * quantity is what the level moves by:
 *
 * | kind | effect on the level |
 * |---|---|
 * | `RETURN`, `ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT`, `SALE`, `COUNT`, `RECEIPT`, `ISSUE`, `WRITE_OFF`, `DAMAGE` | the stated signed quantity, which is what the caller’s own document says happened |
 * | any of the above, stated with `eventOnly` | none: the units never entered this location’s stock, so the level stays where it is, the row records the event and the stated quantity is kept in the row’s note |
 *
 * **An event is a property of the request, not of a kind.** `WRITE_OFF` and `DAMAGE` are stated by
 * callers on both sides of that line and the ledger may not guess which one is speaking. A goods
 * receipt that is reversed states a *delta* — the receipt it undoes moved the level, so the
 * compensating write-off has to move it back, and reading the kind as "no effect" would leave goods
 * the installation no longer holds in the number it sells against. A return whose units came back
 * unsellable states an *event* — those units were never in this location’s stock, so applying their
 * quantity would put unsellable units into the same number, which is the one error an inventory ledger
 * must not make. The first caller states nothing extra and its quantity lands; the second states
 * `eventOnly`, and the quantity it stated is kept in the movement’s own note so the row still says how
 * many units the event was about.
 *
 * **The ledger stays append-only.** A movement is written, never edited and never deleted; a caller
 * that must undo one states its opposite, exactly as the compensation path of a receipt does. Every
 * write here joins the engine’s transaction and takes the level row lock the engine takes, so
 * concurrent writers cannot lose each other’s change.
 *
 * **Tenancy.** Every read is narrowed to the caller’s tenant and organization, and it is narrowed on
 * the aggregate row a level hangs from and a movement was applied to: that row carries the tenant and
 * organization of the stock, because the ledger takes them from the product when it creates it. A
 * movement or a level of another tenant, or of another organization of the same tenant, is not stock
 * this caller may be told about or write against. A caller with neither is not narrowed, which is how
 * the ledger’s own reads treat a worker, a migration or a system context.
 */
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { DecimalString, ID } from '@gauzy/contracts';
import {
	RequestContext,
	WarehouseProductVariant,
	addDecimalStrings,
	compareDecimalStrings,
	formatDecimalUnits,
	parseDecimalString,
	pow10
} from '@gauzy/core';
import { InventoryOrmConnection } from './../inventory.connection';
import { StockMovement } from './../stock-movement/stock-movement.entity';
import { StockLevelService } from './../stock-level/stock-level.service';
import { StockMovementReferenceType, StockMovementType } from './../inventory.enums';
import { InventoryErrorCode, inventoryError } from './../inventory.errors';
import {
	IStockLedgerBalanceQuery,
	IStockLedgerBinBalance,
	IStockLedgerHomeBin,
	IStockLedgerMovementRequest,
	IStockLedgerMovementResult,
	IStockLedgerPutAway,
	IStockLedgerPutAwayResult,
	IStockLedgerRelocation
} from './stock-ledger.types';

/**
 * The fractional digits every quantity column of the ledger carries (`numeric(20, 6)`).
 *
 * A quantity written here is brought to this scale before it reaches the engine, so the movement
 * records what the column will hold and the two sides of the ledger’s invariant are the same number.
 */
const LEDGER_QUANTITY_SCALE = 6;

/**
 * A level row as this seam reads it.
 *
 * The location of a level is a column of the aggregate it hangs from, so a joined read carries it
 * under the join’s own name — `warehouseId` — with the prefixed spelling the platform’s query
 * builders fall back to when a joined column is named apart from the root entity.
 */
type TReadLevel = WarehouseProductVariant & { warehouseId?: ID; __aggregate_warehouseId?: ID };

@Injectable()
export class StockLedgerService {
	constructor(
		@InjectRepository(StockMovement)
		private readonly typeOrmStockMovementRepository: Repository<StockMovement>,
		@InjectRepository(WarehouseProductVariant)
		private readonly typeOrmWarehouseProductVariantRepository: Repository<WarehouseProductVariant>,
		private readonly stockLevelService: StockLevelService,
		// Optional so a suite that constructs this seam over doubled repositories, and an installation
		// that registers only one ORM, both keep working: the TypeORM arm is what answers when no
		// connection seam is present, which is exactly what it answered before the seam existed.
		@Optional() private readonly connection?: InventoryOrmConnection
	) {}

	/*
	|--------------------------------------------------------------------------
	| Reads
	|--------------------------------------------------------------------------
	*/

	/**
	 * Reads the derived balance of one variant at one location, or in one bin of it.
	 *
	 * @param query The location, the variant and, when the question is about a bin, the bin.
	 * @returns The balance, or undefined when the ledger holds no movement for the pair — which is a
	 * different answer from a balance of zero.
	 */
	public async readBinBalance(query: IStockLedgerBalanceQuery): Promise<IStockLedgerBinBalance | undefined> {
		if (!query?.warehouseId || !query?.variantId) {
			return undefined;
		}

		if (this.connection?.usesMikroOrm) {
			return await this.mikroBinBalance(query);
		}

		const read = this.ledgerRead()
			.select('SUM(movement.quantity)', 'quantity')
			.where('movement.warehouseId = :warehouseId', { warehouseId: query.warehouseId })
			.andWhere('movement.variantId = :variantId', { variantId: query.variantId });

		if (query.binId) {
			read.andWhere('movement.binId = :binId', { binId: query.binId });
		}

		this.scopeToCaller(read);

		const raw = await read.getRawOne();

		// A sum over no rows is null rather than zero, and that is the only thing distinguishing "the
		// ledger never recorded this pair" from "it recorded nothing net".
		if (raw?.quantity === null || raw?.quantity === undefined) {
			return undefined;
		}

		return {
			variantId: query.variantId,
			...(query.binId ? { binId: query.binId } : {}),
			quantity: this.quantityText(raw.quantity)
		};
	}

	/**
	 * Reads every derived balance the ledger holds for a set of bins.
	 *
	 * One entry per bin and variant the ledger recorded a movement for, with the movements summed in
	 * the database rather than in memory: a bin is read by a count that is about to compare every
	 * position in scope, so the read has to answer for exactly the positions it was asked about.
	 *
	 * @param binIds The bins to read.
	 * @returns One balance per bin and variant the ledger recorded a movement for. A bin the ledger
	 * recorded nothing about is absent; a pair whose movements net to zero is reported at zero, because
	 * the ledger recorded it and a count compares the level’s claim against it.
	 */
	public async readBinBalances(binIds: ID[]): Promise<IStockLedgerBinBalance[]> {
		if (!binIds?.length) {
			return [];
		}

		if (this.connection?.usesMikroOrm) {
			return await this.mikroBinBalances(binIds);
		}

		const query = this.ledgerRead()
			.select('movement.binId', 'binId')
			.addSelect('movement.variantId', 'variantId')
			.addSelect('SUM(movement.quantity)', 'quantity')
			.where('movement.binId IN (:...binIds)', { binIds })
			.groupBy('movement.binId')
			.addGroupBy('movement.variantId');

		this.scopeToCaller(query);

		const rows = await query.getRawMany();

		return (rows ?? [])
			.filter((row) => row.binId && row.variantId)
			.map((row) => ({
				binId: row.binId as ID,
				variantId: row.variantId as ID,
				quantity: this.quantityText(row.quantity)
			}));
	}

	/**
	 * Reads what the level rows of a location claim sits in a set of bins.
	 *
	 * A level names at most one home bin, so it claims its whole quantity at that bin and nothing at
	 * any other: this is the level’s own statement about where its stock is kept, which is what a
	 * count compares against what the movements recorded.
	 *
	 * @param query The location and the bins in scope.
	 * @returns One claim per level that names one of the bins, with the quantity the level holds.
	 */
	public async readExpectedBinBalances(query: { warehouseId: ID; binIds: ID[] }): Promise<IStockLedgerBinBalance[]> {
		if (!query?.warehouseId || !query?.binIds?.length) {
			return [];
		}

		if (this.connection?.usesMikroOrm) {
			const levels = await this.mikroLevels({ warehouseId: query.warehouseId, binIds: query.binIds });

			return levels
				.filter((level) => level.binId && level.variantId)
				.map((level) => ({
					binId: level.binId as ID,
					variantId: level.variantId as ID,
					quantity: this.quantityText(level.quantity)
				}));
		}

		const read = this.levelRead()
			.select(['level.binId', 'level.variantId', 'level.quantity'])
			.where('aggregate.warehouseId = :warehouseId', { warehouseId: query.warehouseId })
			.andWhere('level.binId IN (:...binIds)', { binIds: query.binIds });

		this.scopeToCaller(read);

		const levels = (await read.getMany()) as TReadLevel[];

		return (levels ?? [])
			.filter((level) => level.binId && level.variantId)
			.map((level) => ({
				binId: level.binId as ID,
				variantId: level.variantId as ID,
				quantity: this.quantityText(level.quantity)
			}));
	}

	/**
	 * Reads where a variant is normally kept at a location, and how much of it the level holds there.
	 *
	 * @param query The location and the variant.
	 * @returns The home bin the level names and the quantity it holds, or undefined when the variant
	 * is not stocked at the location at all. A level that names no bin is answered with its quantity
	 * and no bin, which is the location’s own statement that the stock is not kept in one.
	 */
	public async resolveHomeBin(query: { warehouseId: ID; variantId: ID }): Promise<IStockLedgerHomeBin | undefined> {
		if (!query?.warehouseId || !query?.variantId) {
			return undefined;
		}

		const level = await this.findOneLevel(query.warehouseId, query.variantId);

		if (!level) {
			return undefined;
		}

		return {
			...(level.binId ? { binId: level.binId } : {}),
			quantity: this.quantityText(level.quantity)
		};
	}

	/*
	|--------------------------------------------------------------------------
	| Writes
	|--------------------------------------------------------------------------
	*/

	/**
	 * Writes one movement through the ledger engine.
	 *
	 * The request is the calling package’s statement of what physically happened: which variant, at
	 * which location, in which bin, how many units, and which of its own documents asked for it. The
	 * quantity is brought to the ledger’s scale and is the level’s delta, unless the caller states that
	 * the movement is an event about units that never entered this location’s stock (`eventOnly`, see the
	 * class documentation); the engine then resolves the level row, locks it, validates the domain
	 * invariants against the locked values and writes the append-only row beside the level update —
	 * one transaction, so the two are never apart.
	 *
	 * @param request The movement the caller states.
	 * @returns The movement row that was written and the level it produced, both exact decimals. The
	 * answer is the shape both consuming seams state, field for field.
	 * @throws BadRequestException when the request does not name its location, variant, quantity, kind
	 * or document, or when the kind is not one the ledger has. A movement the ledger cannot place is
	 * refused before anything is written.
	 */
	public async recordMovement(request: IStockLedgerMovementRequest): Promise<IStockLedgerMovementResult> {
		const type = this.typeOf(request);

		this.assertStated(request, ['warehouseId', 'variantId', 'referenceType', 'referenceId']);

		const stated = this.quantityText(request.quantity);
		const delta = request.eventOnly ? this.quantityText(0) : stated;

		const applied = await this.stockLevelService.applyMovement({
			warehouseId: request.warehouseId,
			variantId: request.variantId,
			...(request.binId ? { binId: request.binId } : {}),
			type,
			quantityDelta: Number(delta),
			reservedDelta: 0,
			referenceType: request.referenceType as StockMovementReferenceType,
			referenceId: request.referenceId,
			reason: request.reason,
			// An event-only movement would otherwise leave a row that does not say how many units the
			// event was about; the quantity the caller stated is kept.
			...(delta === stated ? {} : { note: this.eventNoteOf(type, stated) }),
			occurredAt: request.occurredAt
		});

		return this.resultOf(applied.movementId, applied.quantityBefore, delta);
	}

	/**
	 * Relocates units between two bins of one location, as a balanced pair of movements.
	 *
	 * The pair is what makes the move visible to the ledger without changing what the location holds:
	 * the units leave the first bin and arrive in the second, so the level’s own quantity is the same
	 * before and after while the movements recorded against each bin have moved the quantity from one
	 * to the other. Both movements are written through the engine, inside one transaction, so a
	 * relocation is two rows or none and a level that moves between them cannot be left half moved.
	 *
	 * A relocation between a bin and itself is refused: it would write a pair that cancels and move
	 * nothing, which is a caller mistake rather than a physical move. A quantity that is not positive
	 * is refused for the same reason — the direction of a relocation is the pair of bins, not the sign.
	 *
	 * @param request The location, the variant, the two bins, the quantity and its provenance.
	 * @returns The two movements, the one leaving the first bin and the one arriving in the second,
	 * in that order.
	 * @throws BadRequestException when a member is missing, when the two bins are the same bin, or
	 * when the quantity is not positive.
	 */
	public async relocate(request: IStockLedgerRelocation): Promise<IStockLedgerMovementResult[]> {
		this.assertStated(request, ['warehouseId', 'variantId', 'fromBinId', 'toBinId', 'referenceType', 'referenceId']);

		if (String(request.fromBinId) === String(request.toBinId)) {
			throw inventoryError(
				InventoryErrorCode.TRANSFER_SAME_LOCATION,
				'A relocation must move stock between two different bins of one location.',
				{ badRequest: true, details: { binId: request.fromBinId } }
			);
		}

		const stated = this.quantityText(request.quantity);

		if (compareDecimalStrings(stated, '0') <= 0) {
			throw inventoryError(
				InventoryErrorCode.INVARIANT_VIOLATION,
				'A relocation states the quantity it moves as a positive decimal; its direction is the pair of bins.',
				{ badRequest: true, details: { quantity: request.quantity } }
			);
		}

		const leaving = this.negated(stated);

		return await this.typeOrmStockMovementRepository.manager.transaction(async (manager) => {
			const outbound = await this.stockLevelService.applyMovement(
				{
					warehouseId: request.warehouseId,
					variantId: request.variantId,
					binId: request.fromBinId,
					type: StockMovementType.TRANSFER_OUT,
					quantityDelta: Number(leaving),
					reservedDelta: 0,
					referenceType: request.referenceType as StockMovementReferenceType,
					referenceId: request.referenceId,
					reason: request.reason
				},
				manager
			);

			const inbound = await this.stockLevelService.applyMovement(
				{
					warehouseId: request.warehouseId,
					variantId: request.variantId,
					binId: request.toBinId,
					type: StockMovementType.TRANSFER_IN,
					quantityDelta: Number(stated),
					reservedDelta: 0,
					referenceType: request.referenceType as StockMovementReferenceType,
					referenceId: request.referenceId,
					reason: request.reason
				},
				manager
			);

			return [
				this.resultOf(outbound.movementId, outbound.quantityBefore, leaving),
				this.resultOf(inbound.movementId, inbound.quantityBefore, stated)
			];
		});
	}

	/**
	 * Walks received units from where they were dropped into the bin they now live in.
	 *
	 * **The bin becomes the level's home bin, and that is why this is not a relocation.** The home bin is
	 * `warehouse_product_variant.binId` — the record of the operator's decision about where the stock
	 * lives, which a pick reads to know where to send the picker and which the put-away is the only
	 * operation that ever writes. A relocation moves units between two bins a level already holds; a
	 * put-away is how a level comes to hold them in a bin at all, so it writes the column and the movement
	 * in one transaction.
	 *
	 * **The walk is two legs, and it is two legs whether or not the units were recorded in a bin.** When
	 * the caller names the receiving bin, that leg is a `TRANSFER_OUT` from it and the target bin's is a
	 * `TRANSFER_IN`. When it does not — the common case, because a receipt lands in the location rather
	 * than in an address — the leg out is written with **no bin**, which is the position the receipt
	 * recorded those units at. Either way the location's own quantity is the same before and after,
	 * which is the invariant a relocation states and this shares.
	 *
	 * **This used to write the arrival alone, and that double-counted on-hand stock.** The reasoning
	 * behind it was that a `TRANSFER_OUT` of stock "that was never recorded anywhere" would subtract
	 * units the ledger does not have — but the units *are* recorded: the receipt wrote a positive
	 * movement at the location with `binId` null, which is exactly the position the leg out subtracts
	 * from. Without it, receiving a hundred units and putting the same hundred away left the level
	 * reading two hundred against a building holding one hundred, the bin reporting the correct hundred,
	 * and `reconcile` unable to see any of it, because the level and the ledger had both been inflated
	 * by the same amount. `StockAvailabilityService` then offered two hundred for sale.
	 *
	 * The level cannot be driven negative by the correction: the leg out goes through the same engine as
	 * every other movement, and its invariant refuses a quantity the location does not hold. A caller
	 * that really is receiving and addressing in one call states `receiving`, and then the arrival is
	 * the only leg written — which is the shape this method had, kept for the caller it is right for.
	 *
	 * @param request The location, the variant, the target bin, the quantity and its provenance.
	 * @returns The movements that were written, the bin now named as home, and the level after the walk.
	 * @throws BadRequestException when a member is missing or the quantity is not positive, or when the
	 * put-away names the receiving bin as the target — a walk that arrives where it started.
	 */
	public async putAway(request: IStockLedgerPutAway): Promise<IStockLedgerPutAwayResult> {
		this.assertStated(request, ['warehouseId', 'variantId', 'binId', 'referenceType', 'referenceId']);

		const stated = this.quantityText(request.quantity);

		if (compareDecimalStrings(stated, '0') <= 0) {
			throw inventoryError(
				InventoryErrorCode.INVARIANT_VIOLATION,
				'A put-away states the quantity it places as a positive decimal.',
				{ badRequest: true, details: { quantity: request.quantity } }
			);
		}

		if (request.fromBinId && String(request.fromBinId) === String(request.binId)) {
			throw inventoryError(
				InventoryErrorCode.TRANSFER_SAME_LOCATION,
				'A put-away must place the units in a different bin from the one they are recorded in.',
				{ badRequest: true, details: { binId: request.binId } }
			);
		}

		return await this.typeOrmStockMovementRepository.manager.transaction(async (manager) => {
			const reference = {
				referenceType: request.referenceType as StockMovementReferenceType,
				referenceId: request.stockMovementId ?? request.referenceId,
				reason: request.reason
			};

			// The leg out is written for every walk. Its address is the receiving bin when the caller named
			// one and **no bin** otherwise, because that is where a receipt records units it has not
			// addressed yet — the position the walk is taking them out of. Only a caller that states it is
			// also receiving has no leg to leave.
			const outbound = request.receiving
				? undefined
				: await this.stockLevelService.applyMovement(
						{
							warehouseId: request.warehouseId,
							variantId: request.variantId,
							...(request.fromBinId ? { binId: request.fromBinId } : {}),
							type: StockMovementType.TRANSFER_OUT,
							quantityDelta: Number(this.negated(stated)),
							reservedDelta: 0,
							...reference
						},
						manager
				  );

			const inbound = await this.stockLevelService.applyMovement(
				{
					warehouseId: request.warehouseId,
					variantId: request.variantId,
					binId: request.binId,
					type: StockMovementType.TRANSFER_IN,
					quantityDelta: Number(stated),
					reservedDelta: 0,
					...reference
				},
				manager
			);

			// The home bin is written inside the same transaction as the movement that placed the units, so
			// a level never names a bin the ledger has not been told about.
			await this.stockLevelService.setHomeBin(
				{ warehouseId: request.warehouseId, variantId: request.variantId, binId: request.binId },
				manager
			);

			return {
				...(outbound ? { transferOutMovementId: outbound.movementId } : {}),
				transferInMovementId: inbound.movementId,
				binId: request.binId,
				quantityAfter: this.quantityText(
					addDecimalStrings(inbound.quantityBefore ?? 0, stated)
				) as DecimalString
			};
		});
	}

	/**
	 * Names the bin a variant is kept in at a location, writing no movement.
	 *
	 * The declaration counterpart of a relocation: nothing physically moved, so nothing is written to the
	 * ledger — the level row's `binId` is the operator's statement of where the stock is expected to be,
	 * and reconciliation is what reports that statement once it disagrees with the placement. It is on this
	 * seam rather than on the level service because a package that does not own stock asks the ledger to
	 * make statements about it, exactly as it asks the ledger to move it.
	 *
	 * @param request The location, the variant and the bin to name as home.
	 * @returns Whether a level row was found and named.
	 * @throws BadRequestException when a member is missing.
	 */
	public async setHomeBin(request: { warehouseId: ID; variantId: ID; binId: ID }): Promise<boolean> {
		this.assertStated(request, ['warehouseId', 'variantId', 'binId']);

		return this.stockLevelService.setHomeBin(request);
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/
	/**
	 * The joined ledger read every derived balance builds.
	 *
	 * The aggregate a movement was applied to is the row that carries the tenant and the organization
	 * of the stock, and it is the row a read is narrowed on, so the join is stated once here rather
	 * than repeated by each read with a chance to drift.
	 */
	private ledgerRead(): SelectQueryBuilder<StockMovement> {
		return this.typeOrmStockMovementRepository
			.createQueryBuilder('movement')
			.innerJoin('movement.warehouseProduct', 'aggregate');
	}

	/**
	 * The joined level read every claim and home-bin answer builds.
	 *
	 * The location of a level is a property of the aggregate it hangs from, so the join is stated once
	 * here, exactly as the ledger’s own availability lookups state it.
	 */
	private levelRead(): SelectQueryBuilder<WarehouseProductVariant> {
		return this.typeOrmWarehouseProductVariantRepository.manager
			.createQueryBuilder(WarehouseProductVariant, 'level')
			.innerJoin('level.warehouseProduct', 'aggregate');
	}

	/** Reads one level row of a location and variant pair, scoped to the caller. */
	private async findOneLevel(warehouseId: ID, variantId: ID): Promise<TReadLevel | null> {
		if (this.connection?.usesMikroOrm) {
			const levels = await this.mikroLevels({ warehouseId, variantId });

			return levels[0] ?? null;
		}

		const read = this.levelRead()
			.select(['level.id', 'level.variantId', 'level.quantity', 'level.binId'])
			.where('aggregate.warehouseId = :warehouseId', { warehouseId })
			.andWhere('level.variantId = :variantId', { variantId });

		this.scopeToCaller(read);

		return (await read.getOne()) as TReadLevel | null;
	}

	/*
	|--------------------------------------------------------------------------
	| The MikroORM arm of the reads above
	|--------------------------------------------------------------------------
	|
	| Every read in this class was written against TypeORM's query builder, joining through entity
	| metadata that `@MultiORMColumn` and `@MultiORMManyToOne` only emit when `getORMType()` names
	| TypeORM. Under `DB_ORM=mikro-orm` that metadata carries the base entity's four columns and
	| nothing else, so `movement.warehouseId` raised `EntityPropertyNotFoundError` and the join through
	| `level.warehouseProduct` raised for the relation — on a seam the cart, the order and the
	| warehouse packages all bind to. The arms below answer the same questions on that ORM, and the
	| TypeORM ones above are unchanged.
	|
	| The two derived balances are raw statements rather than entity reads, because they are sums
	| grouped in the database and that is what they are for: a count compares every position in scope,
	| and pulling a location's whole movement history into memory to add it up would be a different
	| operation wearing the same name. The statements are written once, in the one spelling a reader
	| can check against the migration that created the tables, and the connection rewrites the
	| identifiers and the parameters for whichever dialect is configured.
	*/

	/**
	 * The derived balance of one pair, or of one bin of it, read through the MikroORM connection.
	 *
	 * @param query The location, the variant and, when the question is about a bin, the bin.
	 * @returns The balance, or undefined when the ledger holds no movement for the pair.
	 */
	private async mikroBinBalance(query: IStockLedgerBalanceQuery): Promise<IStockLedgerBinBalance | undefined> {
		const scope = this.callerScope();
		const rows = await this.connection.rows<{ quantity: unknown }>(
			`SELECT SUM(movement."quantity") AS "quantity"
			 FROM "stock_movement" movement
			 INNER JOIN "warehouse_product" aggregate ON aggregate."id" = movement."warehouseProductId"
			 WHERE movement."warehouseId" = :warehouseId
			   AND movement."variantId" = :variantId
			   AND movement."deletedAt" IS NULL
			   AND aggregate."deletedAt" IS NULL${query.binId ? `\n\t\t\t   AND movement."binId" = :binId` : ''}${scope.sql}`,
			{
				warehouseId: query.warehouseId,
				variantId: query.variantId,
				...(query.binId ? { binId: query.binId } : {}),
				...scope.parameters
			}
		);
		const quantity = rows?.[0]?.quantity;

		// A sum over no rows is null rather than zero, and that is the only thing distinguishing "the
		// ledger never recorded this pair" from "it recorded nothing net".
		if (quantity === null || quantity === undefined) {
			return undefined;
		}

		return {
			variantId: query.variantId,
			...(query.binId ? { binId: query.binId } : {}),
			quantity: this.quantityText(quantity as number | DecimalString)
		};
	}

	/**
	 * Every derived balance the ledger holds for a set of bins, read through the MikroORM connection.
	 *
	 * @param binIds The bins to read.
	 * @returns One balance per bin and variant the ledger recorded a movement for.
	 */
	private async mikroBinBalances(binIds: ID[]): Promise<IStockLedgerBinBalance[]> {
		const scope = this.callerScope();
		// The list is variable-length, so the names are generated with it and bound by the same rewrite
		// every other statement here goes through.
		const named = binIds.map((_binId, index) => `:bin${index}`).join(', ');
		const values = Object.fromEntries(binIds.map((binId, index) => [`bin${index}`, binId]));
		const rows = await this.connection.rows<{ binId: ID; variantId: ID; quantity: unknown }>(
			`SELECT movement."binId" AS "binId", movement."variantId" AS "variantId", SUM(movement."quantity") AS "quantity"
			 FROM "stock_movement" movement
			 INNER JOIN "warehouse_product" aggregate ON aggregate."id" = movement."warehouseProductId"
			 WHERE movement."binId" IN (${named})
			   AND movement."deletedAt" IS NULL
			   AND aggregate."deletedAt" IS NULL${scope.sql}
			 GROUP BY movement."binId", movement."variantId"`,
			{ ...values, ...scope.parameters }
		);

		return (rows ?? [])
			.filter((row) => row.binId && row.variantId)
			.map((row) => ({
				binId: row.binId,
				variantId: row.variantId,
				quantity: this.quantityText(row.quantity as number | DecimalString)
			}));
	}

	/**
	 * The level rows a claim or a home-bin answer is read from, on the MikroORM arm.
	 *
	 * The condition on the aggregate is stated as a nested condition on the relation, which is how
	 * MikroORM expresses the join the TypeORM arm states with `innerJoin`, and the aggregate is
	 * populated so the location it carries travels back with the level.
	 *
	 * @param query The location, and either the bins in scope or the variant.
	 * @returns The level rows, each carrying the location of the aggregate it hangs from.
	 */
	private async mikroLevels(query: { warehouseId: ID; binIds?: ID[]; variantId?: ID }): Promise<TReadLevel[]> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const aggregate: Record<string, unknown> = { warehouseId: query.warehouseId };

		if (tenantId) {
			aggregate.tenantId = tenantId;
		}
		if (organizationId) {
			aggregate.$or = [{ organizationId }, { organizationId: null }];
		}

		const rows = await this.connection.fork().find(
			WarehouseProductVariant,
			{
				...(query.variantId ? { variantId: query.variantId } : {}),
				...(query.binIds?.length ? { binId: { $in: query.binIds } } : {}),
				warehouseProduct: aggregate
			} as never,
			{ populate: ['warehouseProduct'] } as never
		);

		return (rows as unknown as TReadLevel[]).map((level) => ({
			...(level as object),
			warehouseId: (level as { warehouseProduct?: { warehouseId?: ID } }).warehouseProduct?.warehouseId
		})) as TReadLevel[];
	}

	/**
	 * The tenant and organization condition every read here is narrowed by, as a statement fragment.
	 *
	 * It is the same rule {@link scopeToCaller} states to the query builder, written for a raw
	 * statement: the condition is on the aggregate row, and an aggregate that names no organization is
	 * the tenant-wide row and is in scope for every organization of the tenant rather than for none.
	 *
	 * @returns The fragment to append to a `WHERE`, and the values it binds.
	 */
	private callerScope(): { sql: string; parameters: Record<string, unknown> } {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		let sql = '';
		const parameters: Record<string, unknown> = {};

		if (tenantId) {
			sql += `\n\t\t\t   AND aggregate."tenantId" = :tenantId`;
			parameters.tenantId = tenantId;
		}
		if (organizationId) {
			sql += `\n\t\t\t   AND (aggregate."organizationId" = :organizationId OR aggregate."organizationId" IS NULL)`;
			parameters.organizationId = organizationId;
		}

		return { sql, parameters };
	}

	/**
	 * Narrows a read to the tenant and the organization the caller runs in.
	 *
	 * The condition is stated on the aggregate, for the reason the class documents. A caller with no
	 * tenant or no organization is not narrowed, which is how the ledger’s own reads treat a worker, a
	 * migration or a system context.
	 *
	 * An aggregate that names **no** organization is the tenant-wide row — the reading the platform
	 * gives a shared row everywhere else — so it is in scope for every organization of the tenant
	 * rather than for none. The distinction matters most on this seam: a movement written for a product
	 * the tenant shares carries no organization of its own, and a read that insisted on one would report
	 * an empty bin beside a bin the ledger has just been told is full.
	 */
	private scopeToCaller<T>(query: SelectQueryBuilder<T>): void {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (tenantId) {
			query.andWhere('aggregate.tenantId = :tenantId', { tenantId });
		}
		if (organizationId) {
			query.andWhere('(aggregate.organizationId = :organizationId OR aggregate.organizationId IS NULL)', {
				organizationId
			});
		}
	}

	/**
	 * The ledger’s movement type for the kind a caller stated.
	 *
	 * @param request The request being written.
	 * @returns The type of the ledger vocabulary that the stated kind names.
	 * @throws BadRequestException when no kind was stated, or when the kind is not one the ledger has —
	 * a movement of an unknown kind is refused rather than written under a type it does not name.
	 */
	private typeOf(request: IStockLedgerMovementRequest): StockMovementType {
		this.assertStated(request, ['quantity', 'kind']);

		const type = Object.values(StockMovementType).find((value) => value === request.kind);

		if (!type) {
			throw inventoryError(
				InventoryErrorCode.INVARIANT_VIOLATION,
				`"${String(request.kind)}" is not a movement type of the ledger, so the movement cannot be written under it.`,
				{ badRequest: true, details: { kind: request.kind } }
			);
		}

		return type;
	}

	/**
	 * The note kept on a movement that records an event without moving the level.
	 *
	 * @param type The movement type.
	 * @param stated The quantity the caller stated.
	 * @returns The note, which says what the row is and how many units it was about.
	 */
	private eventNoteOf(type: StockMovementType, stated: DecimalString): string {
		return `${type}: the level is unchanged, because the caller stated that these units never entered this location's stock. The caller stated ${stated}.`;
	}

	/**
	 * The answer one written movement produces.
	 *
	 * The resulting quantity is added from the exact decimals rather than read back from the engine’s
	 * own number: the level before the movement is the column’s value at the ledger’s scale and the
	 * delta is the caller’s quantity at the same scale, so the sum is exact and is what the level row
	 * now holds.
	 *
	 * @param movementId The row that was written.
	 * @param quantityBefore The level’s quantity before the movement.
	 * @param delta The exact delta that was applied.
	 * @returns The movement id and the resulting quantity.
	 */
	private resultOf(movementId: ID, quantityBefore: number, delta: DecimalString): IStockLedgerMovementResult {
		return {
			movementId,
			quantityAfter: this.quantityText(addDecimalStrings(quantityBefore ?? 0, delta))
		};
	}

	/**
	 * @param quantity An exact decimal quantity.
	 * @returns The same quantity with the opposite sign, exactly.
	 */
	private negated(quantity: DecimalString): DecimalString {
		const { units, scale } = parseDecimalString(quantity);

		return formatDecimalUnits(-units, scale);
	}

	/**
	 * Refuses a request that does not state members the ledger cannot write without.
	 *
	 * @param request The request being written.
	 * @param members The members this write requires.
	 * @throws BadRequestException naming every member that was not stated.
	 */
	private assertStated(request: unknown, members: string[]): void {
		const stated = (request ?? {}) as Record<string, unknown>;
		const missing = members.filter((member) => {
			const value = stated[member];

			return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
		});

		if (missing.length) {
			throw inventoryError(
				InventoryErrorCode.INVARIANT_VIOLATION,
				`A movement names its location, its variant, its signed quantity, its kind and the document that caused it; ${missing.join(
					', '
				)} was not stated.`,
				{ badRequest: true, details: { missing } }
			);
		}
	}

	/**
	 * Reads a quantity as exact decimal text at the ledger’s scale.
	 *
	 * A quantity arrives as exact decimal text, and every column the ledger stores one in carries the
	 * same scale, so a value of a finer scale is brought to that scale here — half-up, on the exact
	 * digits — rather than silently truncated by a column. That is the scale the delta reaches the
	 * engine at and the scale the resulting quantity is reported at, so the movement, the level and
	 * the answer are one number.
	 *
	 * @param value The quantity the caller stated, when it stated one.
	 * @returns The quantity as exact decimal text at the ledger’s scale.
	 * @throws BadRequestException when the value is not a decimal quantity at all.
	 */
	private quantityText(value?: number | DecimalString | null): DecimalString {
		let units: bigint;
		let scale: number;

		try {
			({ units, scale } = parseDecimalString(value ?? 0));
		} catch {
			throw inventoryError(
				InventoryErrorCode.INVARIANT_VIOLATION,
				`"${String(value)}" is not an exact decimal, so it cannot be written to the ledger as a quantity.`,
				{ badRequest: true, details: { quantity: value } }
			);
		}

		if (scale === LEDGER_QUANTITY_SCALE) {
			return formatDecimalUnits(units, scale);
		}
		if (scale < LEDGER_QUANTITY_SCALE) {
			return formatDecimalUnits(units * pow10(LEDGER_QUANTITY_SCALE - scale), LEDGER_QUANTITY_SCALE);
		}

		const drop = pow10(scale - LEDGER_QUANTITY_SCALE);
		const half = drop / 2n;

		return formatDecimalUnits((units + (units < 0n ? -half : half)) / drop, LEDGER_QUANTITY_SCALE);
	}
}
