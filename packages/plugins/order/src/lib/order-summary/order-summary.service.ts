import { Injectable } from '@nestjs/common';
import { ID, IOrderTotals } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { IOrderRowScope, createUnderOrderScope } from '../order-history/order-row-scope';
import { OrderSummary } from './order-summary.entity';
import { TypeOrmOrderSummaryRepository } from './repository/type-orm-order-summary.repository';
import { MikroOrmOrderSummaryRepository } from './repository/mikro-orm-order-summary.repository';

/**
 * One version's summary, as the totals writer states it.
 */
export interface IOrderSummaryEntry {
	/** The order. */
	orderId: ID;
	/** The version the conditional update produced. */
	version: number;
	/** The totals written with that version. */
	totals: IOrderTotals;
	/** The order's currency. */
	currency: string;
	/** Why the totals moved: `PLACED`, `CHANGE_CONFIRMED`, `DRIFT_REPAIRED`, … */
	reason: string;
}

/**
 * the totals of each committed order version. Append-only: one row per version, never edited, never skipped.
 */
@Injectable()
export class OrderSummaryService extends TenantAwareCrudService<OrderSummary> {
	constructor(
		readonly typeOrmOrderSummaryRepository: TypeOrmOrderSummaryRepository,
		readonly mikroOrmOrderSummaryRepository: MikroOrmOrderSummaryRepository
	) {
		super(typeOrmOrderSummaryRepository, mikroOrmOrderSummaryRepository);
	}

	/**
	 * Appends the summary of one committed version, in the order's own tenant and organization.
	 *
	 * The totals writer is reached from a request and from the worker's scheduled passes alike, and the
	 * row belongs to the order's tenancy on both — see {@link createUnderOrderScope} for why that has to
	 * be stated rather than left to the tenant-aware create when no request is behind the write.
	 *
	 * @param entry The version's summary.
	 * @param scope The order's tenancy, read from the order row.
	 * @returns The appended row.
	 */
	public async append(entry: IOrderSummaryEntry, scope?: IOrderRowScope): Promise<OrderSummary> {
		return createUnderOrderScope<OrderSummary>(
			this,
			{ typeOrm: this.typeOrmOrderSummaryRepository, mikroOrm: this.mikroOrmOrderSummaryRepository },
			// The relation beside its id, because under MikroORM the id alone is not what is written.
			{ ...entry, order: { id: entry.orderId } },
			scope
		);
	}
}
