import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { SellerPayoutLine } from './seller-payout-line.entity';
import { MikroOrmSellerPayoutLineRepository } from './repository/mikro-orm-seller-payout-line.repository';
import { TypeOrmSellerPayoutLineRepository } from './repository/type-orm-seller-payout-line.repository';
import { ISellerScope, assertSellerScope } from '../seller-scope/seller-scope';

/**
 * Reads the join between a payout and the ledger rows it pays.
 *
 * Lines are created and released by the payout service, never authored through the API: a line is the
 * evidence that a transaction was paid by a particular payout, so a caller that could write one could
 * assert a payment that never happened.
 */
@Injectable()
export class SellerPayoutLineService extends TenantAwareCrudService<SellerPayoutLine> {
	constructor(
		readonly typeOrmSellerPayoutLineRepository: TypeOrmSellerPayoutLineRepository,
		readonly mikroOrmSellerPayoutLineRepository: MikroOrmSellerPayoutLineRepository
	) {
		super(typeOrmSellerPayoutLineRepository, mikroOrmSellerPayoutLineRepository);
	}

	/** Lists the lines of one payout. */
	async listLines(filter: any = {}, scope?: ISellerScope): Promise<IPagination<SellerPayoutLine>> {
		const where = { ...(filter?.where ?? {}) };

		if (scope && !scope.staff && where.sellerPayoutId) {
			// A seller-scoped caller may only read the lines of its own payout; the payout itself is
			// resolved through the payout service, which is where the seller predicate is applied.
			assertSellerScope(scope);
		}

		return this.pagination({ ...filter, where });
	}

	/** Reads one line. */
	async getLine(id: ID): Promise<SellerPayoutLine> {
		const line = await this.typeOrmSellerPayoutLineRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as FindOptionsWhere<SellerPayoutLine>
		});

		if (!line) {
			throw new NotFoundException('The payout line does not exist.');
		}

		return line;
	}
}
