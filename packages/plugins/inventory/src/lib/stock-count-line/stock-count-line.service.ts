import { Injectable } from '@nestjs/common';
import { FindManyOptions, In } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { ProductVariantPrice, RequestContext, TenantAwareCrudService } from '@gauzy/core';
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
	 */
	public async varianceOf(stockCountId: string): Promise<{ units: number; value: number; unpricedLines: number }> {
		const tenantId = RequestContext.currentTenantId();
		const lines = await this.typeOrmStockCountLineRepository.find({
			where: { stockCountId, ...(tenantId ? { tenantId } : {}) } as any
		});
		let units = 0;
		let value = 0;
		let unpricedLines = 0;

		// One read for the whole session rather than one per line: a count of a thousand lines asked
		// the database a thousand times for rows it could have read once.
		const costs = await this.unitCostsOf(lines.map((line) => line.variantId));

		for (const line of lines) {
			const variance = Math.abs(Number(line.variance ?? 0));
			if (variance === 0) {
				continue;
			}
			units += variance;
			const cost = costs.get(line.variantId);
			if (cost === null || cost === undefined) {
				unpricedLines += 1;
				continue;
			}
			value += variance * cost;
		}

		return { units, value, unpricedLines };
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
	 * @param variantIds The variants to price. Duplicates and blanks are ignored.
	 * @returns The unit cost per variant id, absent for a variant with no price row.
	 */
	private async unitCostsOf(variantIds: ID[]): Promise<Map<ID, number>> {
		const wanted = Array.from(new Set(variantIds.filter((variantId) => !!variantId)));
		const costs = new Map<ID, number>();

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

			if (variantId && row.unitCost !== null && row.unitCost !== undefined) {
				costs.set(variantId, Number(row.unitCost));
			}
		}

		return costs;
	}
}
