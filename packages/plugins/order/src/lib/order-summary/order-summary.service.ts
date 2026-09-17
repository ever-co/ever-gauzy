import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { OrderSummary } from './order-summary.entity';
import { TypeOrmOrderSummaryRepository } from './repository/type-orm-order-summary.repository';
import { MikroOrmOrderSummaryRepository } from './repository/mikro-orm-order-summary.repository';

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
}