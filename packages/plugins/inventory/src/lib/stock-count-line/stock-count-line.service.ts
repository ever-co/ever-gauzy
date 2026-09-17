import { Injectable } from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import { IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
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
		const lines = await this.typeOrmStockCountLineRepository.find({ where: { stockCountId } as any });
		let units = 0;
		let value = 0;
		let unpricedLines = 0;

		for (const line of lines) {
			const variance = Math.abs(Number(line.variance ?? 0));
			if (variance === 0) {
				continue;
			}
			units += variance;
			const cost = await this.unitCostOf(line.variantId);
			if (cost === null) {
				unpricedLines += 1;
				continue;
			}
			value += variance * cost;
		}

		return { units, value, unpricedLines };
	}

	/** Reads the recorded unit cost of a variant, or null when none is recorded. */
	private async unitCostOf(variantId: string): Promise<number | null> {
		const raw = await this.typeOrmStockCountLineRepository.manager.query(
			'SELECT "unitCost" FROM "product_variant_price" WHERE "variantId" = $1 LIMIT 1',
			[variantId]
		);
		if (!raw || !raw[0] || raw[0].unitCost === null || raw[0].unitCost === undefined) {
			return null;
		}
		return Number(raw[0].unitCost);
	}
}
