import { Injectable } from '@nestjs/common';
import { FindManyOptions, In } from 'typeorm';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import {
	ProductVariantPrice,
	RequestContext,
	TenantAwareCrudService,
	addDecimalStrings,
	compareDecimalStrings,
	formatDecimalUnits,
	multiplyDecimalUnits,
	parseDecimalString
} from '@gauzy/core';
import { StockCountLine } from './stock-count-line.entity';
import { TypeOrmStockCountLineRepository } from './repository/type-orm-stock-count-line.repository';
import { MikroOrmStockCountLineRepository } from './repository/mikro-orm-stock-count-line.repository';

/**
 * Reads the lines of a count session.
 *
 * Lines are generated when a session is opened and closed by the session itself, so this service
 * exposes reads and the variance report rather than a write path of its own. A line editable in
 * isolation would let a caller change what a signed-off session says.
 */
@Injectable()
export class StockCountLineService extends TenantAwareCrudService<StockCountLine> {
	constructor(
		readonly typeOrmStockCountLineRepository: TypeOrmStockCountLineRepository,
		readonly mikroOrmStockCountLineRepository: MikroOrmStockCountLineRepository
	) {
		super(typeOrmStockCountLineRepository, mikroOrmStockCountLineRepository);
	}

	/** Lists count lines. */
	public async findLines(filter?: FindManyOptions<StockCountLine>): Promise<IPagination<StockCountLine>> {
		return await this.paginate(filter ?? {});
	}

	/**
	 * Sums the absolute variance of a session, in units and valued at the line’s cost when one is
	 * known.
	 *
	 * A null cost counts as zero and is reported, rather than being guessed: a valuation built on an
	 * invented cost is worse than a valuation that says it is incomplete.
	 *
	 * **The arithmetic is exact, and that is not a refinement.** A variance is a `numeric(20,6)`
	 * quantity and a unit cost is a `numeric(20,6)` amount; multiplying and then accumulating them as
	 * JavaScript doubles is the arithmetic that turns `0.1 × 0.1` into `0.010000000000000002` and three
	 * of them into `0.030000000000000006`. This report is the figure a location signs a stock write-off
	 * off against, so it is summed over the exact digits of the two columns — the product is taken at
	 * the combined scale, the running totals are exact decimal text, and the conversion to the `number`
	 * this seam states happens once, at the end, on a value that is already right.
	 *
	 * @param stockCountId The session to value.
	 * @returns The total absolute variance in units, its valuation, and how many lines could not be
	 * valued because no cost is recorded for their variant.
	 */
	public async varianceOf(stockCountId: string): Promise<{ units: number; value: number; unpricedLines: number }> {
		const tenantId = RequestContext.currentTenantId();
		const lines = await this.typeOrmStockCountLineRepository.find({
			where: { stockCountId, ...(tenantId ? { tenantId } : {}) } as any
		});
		let units: DecimalString = '0';
		let value: DecimalString = '0';
		let unpricedLines = 0;

		// One read for the whole session rather than one per line: a count of a thousand lines asked
		// the database a thousand times for rows it could have read once.
		const costs = await this.unitCostsOf(lines.map((line) => line.variantId));

		for (const line of lines) {
			const variance = this.absolute(this.decimalOf(line.variance) ?? '0');
			if (compareDecimalStrings(variance, '0') === 0) {
				continue;
			}
			units = addDecimalStrings(units, variance);
			const cost = costs.get(line.variantId);
			if (cost === null || cost === undefined) {
				unpricedLines += 1;
				continue;
			}
			value = addDecimalStrings(value, this.product(variance, cost));
		}

		return { units: Number(units), value: Number(value), unpricedLines };
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/**
	 * Reads a stored numeric column as exact decimal text.
	 *
	 * A `numeric(20,6)` column reaches this code as whatever the driver and the platform's transformer
	 * produced — a `number` on one dialect, the digits as text on another — and either is an exact
	 * decimal. A value that is not one at all is answered with nothing rather than with zero, so a
	 * missing cost stays distinguishable from a cost of nothing.
	 *
	 * @param value The column as it was read.
	 * @returns The exact decimal text, or undefined when the column holds no decimal.
	 */
	private decimalOf(value: unknown): DecimalString | undefined {
		if (value === null || value === undefined) {
			return undefined;
		}

		try {
			const { units, scale } = parseDecimalString(value as DecimalString | number);

			return formatDecimalUnits(units, scale);
		} catch {
			return undefined;
		}
	}

	/**
	 * @param value An exact decimal.
	 * @returns Its magnitude, exactly.
	 */
	private absolute(value: DecimalString): DecimalString {
		const { units, scale } = parseDecimalString(value);

		return formatDecimalUnits(units < 0n ? -units : units, scale);
	}

	/**
	 * Multiplies two exact decimals, keeping every digit of the product.
	 *
	 * The product of two six-decimal values lands at twelve decimals, and it is kept there rather than
	 * rounded per line: rounding each line and then adding is a different number from adding and then
	 * rounding, and the second is the one a valuation owes. Whoever presents the figure decides where
	 * it is rounded.
	 *
	 * @param left One factor.
	 * @param right The other.
	 * @returns The exact product.
	 */
	private product(left: DecimalString, right: DecimalString): DecimalString {
		const multiplied = multiplyDecimalUnits(parseDecimalString(left), parseDecimalString(right));

		return formatDecimalUnits(multiplied.units, multiplied.scale);
	}

	/**
	 * Reads the recorded unit cost of each variant.
	 *
	 * **This was a raw statement that could not run anywhere.** It selected `"variantId"` from
	 * `product_variant_price`, and that table has no such column — the price row names its variant
	 * `productVariantId`, as the relation's join column always has — so the read raised and took the
	 * whole variance report with it. It also wrote `$1` and double-quoted identifiers by hand, which
	 * is Postgres syntax alone: MySQL reads those quotes as a string literal, and neither SQLite
	 * driver binds `$1` from an array.
	 *
	 * Asking through the entity answers all three at once. The relation is stated as a relation, so
	 * the ORM writes the join column's real name and quotes it for whichever dialect is configured,
	 * and the identifiers are bound rather than interpolated.
	 *
	 * The cost is kept as exact decimal text rather than as a `number`: it is one of the two factors of
	 * the valuation above, and reading a `numeric(20,6)` column through a double is where the digits
	 * are lost, not where they are multiplied.
	 *
	 * @param variantIds The variants to price. Duplicates and blanks are ignored.
	 * @returns The unit cost per variant id, absent for a variant with no price row.
	 */
	private async unitCostsOf(variantIds: ID[]): Promise<Map<ID, DecimalString>> {
		const wanted = Array.from(new Set(variantIds.filter((variantId) => !!variantId)));
		const costs = new Map<ID, DecimalString>();

		if (!wanted.length) {
			return costs;
		}

		const tenantId = RequestContext.currentTenantId();
		// The price row carries the tenant that owns it, and a valuation must not be able to read a
		// cost recorded by another one.
		const rows = await this.typeOrmStockCountLineRepository.manager.find(ProductVariantPrice, {
			where: {
				productVariant: { id: In(wanted) },
				...(tenantId ? { tenantId } : {})
			} as any,
			relations: { productVariant: true }
		});

		for (const row of rows) {
			const variantId = row.productVariant?.id as ID;
			const cost = this.decimalOf(row.unitCost);

			if (variantId && cost !== undefined) {
				costs.set(variantId, cost);
			}
		}

		return costs;
	}
}
