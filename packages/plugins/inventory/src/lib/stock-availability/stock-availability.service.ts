/**
 * What may be sold of a variant, answered from the level rows the ledger maintains.
 *
 * Nothing here is stored and nothing here is written: availability is a derivation over the level
 * rows, and the derivation is the ledger’s own rule — on hand, less what is held, less the buffer
 * that may not be sold. The class owns no table and reserves nothing; a hold is the reservation
 * service’s to take, and this seam only answers what a caller may ask for before it takes one.
 *
 * Four decisions belong to this class, and everything else is the ledger’s:
 *
 * 1. **A variant that is not stocked is not answered for.** A level row is created the first time a
 *    variant is stocked at a location, so a missing row is a location that holds none of it — a
 *    different fact from a level that holds zero, and one no quantity can be read from. The answer is
 *    nothing at all, which the caller reads as "nothing can be sold here" rather than as a number
 *    this class invented. An empty network answers the same way.
 * 2. **A question that names no location is answered for the caller’s whole network.** The level
 *    rows of the variant are summed across the locations that stock it, which is the reading this
 *    package already applies to the same question — the low-stock scan asks it of a rule whose
 *    location is optional and sums across every location when none is named. Summing is the answer
 *    that keeps a caller selling: the alternative — refusing because no single location was named —
 *    would refuse every line whose channel has not pinned a location, which is a refusal the data
 *    cannot justify. The policy fields are then read the same way, across the levels: a backorder is
 *    reported when any level the variant is stocked at accepts one, because the caller’s next step
 *    decides the location for real and is the guard that finally applies.
 * 3. **An uncounted level is reported as unbounded.** A level marked unlimited takes a hold of any
 *    size — the ledger’s guard lets it through — so its stored quantity is not a ceiling and must not
 *    be reported as one. `UNBOUNDED_SELLABLE` is what this seam says instead, and the reason it is a
 *    number at all is that the seam states its quantities as numbers.
 * 4. **The quantities are exact decimals until the last step.** On hand, held and buffer are
 *    `numeric(20,6)` values, and the sum is taken over their exact decimal texts rather than over
 *    floating-point arithmetic: a caller compares the answer with a quantity at a boundary, and
 *    `0.3 − 0.1` evaluated as a double is below `0.2`, which would refuse the last available unit.
 *    The conversion to the `number` the seam states happens once, when the answer is returned.
 *
 * Every read is narrowed to the caller’s tenant and organization, on the aggregate row the level
 * hangs from: that row carries the tenant and organization of the stock — a level row is created by
 * the ledger under the aggregate, which takes them from the product — so a level of another tenant
 * or of another organization of the same tenant is not stock this caller may be told about. A caller
 * with neither (a worker, a migration, a system context) is not narrowed, exactly as the ledger’s own
 * reads behave.
 */
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { DecimalString, ID } from '@gauzy/contracts';
import {
	RequestContext,
	WarehouseProductVariant,
	addDecimalStrings,
	parseDecimalString,
	formatDecimalUnits,
	pow10,
	subtractDecimalStrings
} from '@gauzy/core';
import { InventoryOrmConnection } from './../inventory.connection';
import { StockLevelService } from './../stock-level/stock-level.service';
import { IStockAvailabilityQuery, IStockSellability, UNBOUNDED_SELLABLE } from './stock-availability.types';

/**
 * The fractional digits every quantity column of the ledger carries (`numeric(20, 6)`).
 *
 * The availability of a level is summed at this scale, which is the scale the caller’s own quantity
 * is stored at, so the comparison it makes is between two values of the same precision.
 */
const LEDGER_QUANTITY_SCALE = 6;

/**
 * A level row as this seam reads it.
 *
 * The location of a level is a column of the aggregate it hangs from, so a joined read carries it
 * under the join’s own name — `warehouseId` — with the prefixed spelling the platform’s query
 * builders fall back to when a joined column is named apart from the root entity.
 */
type TSellableLevel = WarehouseProductVariant & { warehouseId?: ID; __aggregate_warehouseId?: ID };

@Injectable()
export class StockAvailabilityService {
	constructor(
		@InjectRepository(WarehouseProductVariant)
		private readonly typeOrmWarehouseProductVariantRepository: Repository<WarehouseProductVariant>,
		private readonly stockLevelService: StockLevelService,
		// Optional so a suite that constructs this service over a doubled repository, and an
		// installation that registers only one ORM, both keep working: the TypeORM arm is what answers
		// when no connection seam is present, which is exactly what it answered before the seam existed.
		@Optional() private readonly connection?: InventoryOrmConnection
	) {}

	/**
	 * Reads what may be sold of one variant, at one location or across the caller’s locations.
	 *
	 * @param query The variant, and the location when one is known.
	 * @returns What may be sold and how far past the stock the caller may go, or null when the variant
	 * is not stocked anywhere the question reaches — and null for a question that names no variant,
	 * which is not a stock question at all and must not become an exception in the caller’s report.
	 */
	public async availabilityOf(query: IStockAvailabilityQuery): Promise<IStockSellability | null> {
		if (!query?.variantId) {
			return null;
		}

		const levels = await this.levelsOf(query.variantId, query.warehouseId);

		if (!levels.length) {
			return null;
		}

		// The policy of each level is read through the ledger’s own derivation, so what a level allows
		// has one author; the quantity is taken from the columns themselves, because it is summed here
		// and the sum has to be exact.
		const policies = levels.map((level) => this.policyOf(level, query.warehouseId));
		const uncounted = policies.some((policy) => policy.isUnlimited);
		const backordering = policies.filter((policy) => policy.allowBackorder === true);
		const ceiling = this.ceilingOf(backordering.map((policy) => policy.backorderLimit));

		return {
			sellableQuantity: uncounted ? UNBOUNDED_SELLABLE : Number(this.sellableOf(levels)),
			allowBackorder: backordering.length > 0,
			...(ceiling === undefined ? {} : { backorderLimit: ceiling })
		};
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/**
	 * The level rows of one variant, narrowed to a location when one is named.
	 *
	 * The location is a property of the product-level aggregate the level hangs from, so the read
	 * joins through it rather than filtering a column the level table does not have — the same read
	 * the ledger’s own availability lookups use. The scope is applied to the aggregate for the reason
	 * the class documents: it is the row that carries the tenant and the organization of the stock.
	 *
	 * **The read is expressed once per ORM, because a query builder is not portable between them.**
	 * `@MultiORMColumn` and `@MultiORMManyToOne` emit only the configured ORM's decorator, so under
	 * `DB_ORM=mikro-orm` TypeORM's metadata for `warehouse_product_variant` carries the base entity's
	 * four columns and nothing else — and this read, which filters on `level.variantId` and joins
	 * through `level.warehouseProduct`, raised `EntityPropertyNotFoundError` on the first add-to-cart
	 * of the installation. The two arms answer the same question and produce the same shape; the
	 * TypeORM one below is unchanged.
	 */
	private async levelsOf(variantId: ID, warehouseId?: ID): Promise<TSellableLevel[]> {
		if (this.connection?.usesMikroOrm) {
			return await this.mikroLevelsOf(variantId, warehouseId);
		}

		const query = this.typeOrmWarehouseProductVariantRepository.manager
			.createQueryBuilder(WarehouseProductVariant, 'level')
			.innerJoin('level.warehouseProduct', 'aggregate')
			.select(['level.id', 'level.variantId', 'level.quantity', 'level.reservedQuantity'])
			.addSelect([
				'level.safetyStock',
				'level.incomingQuantity',
				'level.isUnlimited',
				'level.allowBackorder',
				'level.backorderLimit',
				'aggregate.warehouseId'
			])
			.where('level.variantId = :variantId', { variantId });

		if (warehouseId) {
			query.andWhere('aggregate.warehouseId = :warehouseId', { warehouseId });
		}

		this.scopeToCaller(query);

		return (await query.getMany()) as TSellableLevel[];
	}

	/**
	 * The same read, expressed for MikroORM.
	 *
	 * The condition on the aggregate is stated as a nested condition on the relation, which is how
	 * MikroORM expresses the join TypeORM's builder states with `innerJoin`: naming the relation makes
	 * the read a join, and the aggregate is populated so the location it carries travels back with the
	 * level. The organization condition is a disjunction for the reason the class documents — an
	 * aggregate that names no organization is the tenant-wide row and is in scope for every
	 * organization of the tenant, not for none.
	 *
	 * @param variantId The variant.
	 * @param warehouseId The location, when the question names one.
	 * @returns The level rows, each carrying the location of the aggregate it hangs from.
	 */
	private async mikroLevelsOf(variantId: ID, warehouseId?: ID): Promise<TSellableLevel[]> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const aggregate: Record<string, unknown> = {};

		if (warehouseId) {
			aggregate.warehouseId = warehouseId;
		}
		if (tenantId) {
			aggregate.tenantId = tenantId;
		}
		if (organizationId) {
			aggregate.$or = [{ organizationId }, { organizationId: null }];
		}

		const rows = await this.connection.fork().find(
			WarehouseProductVariant,
			{
				variantId,
				...(Object.keys(aggregate).length ? { warehouseProduct: aggregate } : {})
			} as never,
			{ populate: ['warehouseProduct'] } as never
		);

		return (rows as unknown as TSellableLevel[]).map((level) => ({
			...(level as object),
			// The joined read on the other arm answers the location under the join's own name, so the
			// two arms hand the same shape to everything above them.
			warehouseId: (level as { warehouseProduct?: { warehouseId?: ID } }).warehouseProduct?.warehouseId
		})) as TSellableLevel[];
	}

	/**
	 * The ledger’s own reading of one level’s policy.
	 *
	 * @param level The level row as the read returned it.
	 * @param warehouseId The location the question named, when it named one.
	 * @returns The ledger’s derivation for the row, whose policy fields are what this seam reports.
	 */
	private policyOf(level: TSellableLevel, warehouseId?: ID) {
		return this.stockLevelService.toAvailability(
			level,
			warehouseId ?? level.warehouseId ?? level.__aggregate_warehouseId
		);
	}

	/**
	 * What may be sold of one level, exactly, and of every level the read returned.
	 *
	 * The rule is the ledger’s — on hand, less what is held, less the unsellable buffer — stated over
	 * the exact decimal texts of the three columns rather than over their floating-point values, and
	 * summed the same way. A level whose buffer exceeds what it holds contributes a negative number,
	 * which is what its own availability is: the buffer is a floor the stock is below, and hiding it
	 * by clamping at zero would report stock that may not be sold.
	 *
	 * @param levels The level rows to total.
	 * @returns The exact decimal total.
	 */
	private sellableOf(levels: TSellableLevel[]): DecimalString {
		return levels.reduce(
			(total, level) =>
				addDecimalStrings(
					total,
					subtractDecimalStrings(
						subtractDecimalStrings(
							this.quantityText(level.quantity),
							this.quantityText(level.reservedQuantity)
						),
						this.quantityText(level.safetyStock)
					)
				),
			'0'
		);
	}

	/**
	 * How far past the stock the caller may go, as the seam states it.
	 *
	 * A backorder with no stated ceiling is no ceiling at all — the ledger applies the policy without
	 * a limit — so the reported bound is the one no stated quantity can exceed, which is the same
	 * value an uncounted level is reported with, for the same reason.
	 *
	 * @param limits The ceilings of the levels that accept a backorder, undefined where a level states
	 * none.
	 * @returns The ceiling as a number, or undefined when no level accepts a backorder.
	 */
	private ceilingOf(limits: Array<number | undefined>): number | undefined {
		if (!limits.length) {
			return undefined;
		}

		if (limits.some((limit) => limit === null || limit === undefined)) {
			return UNBOUNDED_SELLABLE;
		}

		return Number(limits.reduce<DecimalString>((total, limit) => addDecimalStrings(total, this.quantityText(limit)), '0'));
	}

	/**
	 * Narrows a level read to the tenant and the organization the caller runs in.
	 *
	 * The aggregate is the row the condition is stated on, for the reason the class documents. A
	 * caller with no tenant or no organization is not narrowed, which is how the ledger’s own reads
	 * treat a worker, a migration or a system context.
	 *
	 * An aggregate that names **no** organization is the tenant-wide row — the reading the platform
	 * gives a shared row everywhere else — so it is in scope for every organization of the tenant
	 * rather than for none. Narrowing to the caller’s own organization alone would answer zero for a
	 * product the tenant shares, which is a wrong answer rather than a narrow one: the stock exists, at
	 * that location, and a channel asking whether it can sell is entitled to count it.
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
	 * Reads a stored quantity as exact decimal text at the ledger’s scale.
	 *
	 * A quantity column arrives as the value the platform’s numeric transformer produced, which is a
	 * `number` for a `numeric(20,6)` column, and a sum read back from a driver may arrive as a string
	 * or as a number with the artefact of floating-point addition. Rendering it at the scale the
	 * column carries is what makes the arithmetic above exact, and a value that is not a decimal at
	 * all is refused rather than treated as zero.
	 *
	 * @param value The stored quantity, when the column holds one.
	 * @returns The quantity as exact decimal text at the ledger’s scale.
	 */
	private quantityText(value?: number | DecimalString | null): DecimalString {
		let units: bigint;
		let scale: number;

		try {
			({ units, scale } = parseDecimalString(value ?? 0));
		} catch {
			throw new Error(
				`STOCK_QUANTITY_NOT_DECIMAL: "${String(value)}" is not an exact decimal, so it cannot be read as a quantity.`
			);
		}

		if (scale === LEDGER_QUANTITY_SCALE) {
			return formatDecimalUnits(units, scale);
		}
		if (scale < LEDGER_QUANTITY_SCALE) {
			return formatDecimalUnits(units * pow10(LEDGER_QUANTITY_SCALE - scale), LEDGER_QUANTITY_SCALE);
		}

		// Half-up at the column’s scale, applied to the exact digits, so the value read is the value
		// the column would hold rather than a truncated one.
		const drop = pow10(scale - LEDGER_QUANTITY_SCALE);
		const half = drop / 2n;

		return formatDecimalUnits((units + (units < 0n ? -half : half)) / drop, LEDGER_QUANTITY_SCALE);
	}
}
