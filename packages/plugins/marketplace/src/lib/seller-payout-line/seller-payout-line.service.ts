import { ForbiddenException, Injectable, MethodNotAllowedException, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { SellerPayoutLine } from './seller-payout-line.entity';
import { MikroOrmSellerPayoutLineRepository } from './repository/mikro-orm-seller-payout-line.repository';
import { TypeOrmSellerPayoutLineRepository } from './repository/type-orm-seller-payout-line.repository';
import { SellerPayout } from '../seller-payout/seller-payout.entity';
import { TypeOrmSellerPayoutRepository } from '../seller-payout/repository/type-orm-seller-payout.repository';
import { ISellerScope } from '../seller-scope/seller-scope';

/** What a deletion, archive or restore of a line answers with, whichever route or mutation asked. */
const A_LINE_IS_RELEASED_BY_ITS_PAYOUT =
	'A payout line is released by canceling its payout; it is never deleted or restored by a caller.';

/**
 * Reads the join between a payout and the ledger rows it pays.
 *
 * Lines are created and released by the payout service, never authored through the API: a line is the
 * evidence that a transaction was paid by a particular payout, so a caller that could write one could
 * assert a payment that never happened.
 *
 * A seller-scoped caller reads the lines of **its own** payouts. The check resolves the payout and
 * compares its seller, rather than trusting the caller's `sellerPayoutId` parameter: a route that
 * filtered only by the id a caller supplied would let one seller read another's payments by guessing
 * one.
 */
@Injectable()
export class SellerPayoutLineService extends TenantAwareCrudService<SellerPayoutLine> {
	constructor(
		readonly typeOrmSellerPayoutLineRepository: TypeOrmSellerPayoutLineRepository,
		readonly mikroOrmSellerPayoutLineRepository: MikroOrmSellerPayoutLineRepository,
		private readonly payoutRepository: TypeOrmSellerPayoutRepository
	) {
		super(typeOrmSellerPayoutLineRepository, mikroOrmSellerPayoutLineRepository);
	}

	/** Lists payout lines, narrowed to the caller's own payouts. */
	async listLines(filter: any = {}, scope?: ISellerScope): Promise<IPagination<SellerPayoutLine>> {
		const where = { ...(filter?.where ?? {}) };

		if (scope && !scope.staff) {
			if (where.sellerPayoutId) {
				await this.assertPayoutScope(where.sellerPayoutId, scope);
			} else {
				// Without a payout to narrow by, the caller's own payouts are what it may read: listing
				// every line and filtering afterwards would hand the caller rows it may not see.
				const own = await this.payoutRepository.find({
					where: { sellerId: scope.sellerId } as FindOptionsWhere<SellerPayout>,
					select: ['id'] as any
				});
				where.sellerPayoutId = own.map((payout) => payout.id);
			}
		}

		return this.paginate({ ...filter, where });
	}

	/** Reads one line, refusing one that belongs to another seller's payout. */
	async getLine(id: ID, scope?: ISellerScope): Promise<SellerPayoutLine> {
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

		if (scope && !scope.staff) {
			await this.assertPayoutScope(line.sellerPayoutId, scope);
		}

		return line;
	}

	/**
	 * Refuses to delete a line.
	 *
	 * A live line is what keeps its transaction out of every later payout run, so deleting the line of a
	 * paid payout left the transaction payable a second time. A line is released by canceling its payout,
	 * which archives it in the payout's own transaction. Refusing here covers the REST route and the
	 * GraphQL mutation alike.
	 */
	public async delete(..._args: unknown[]): Promise<DeleteResult> {
		throw new MethodNotAllowedException(A_LINE_IS_RELEASED_BY_ITS_PAYOUT);
	}

	/** Refuses to archive a line, for the reason `delete` does. */
	public async softRemove(..._args: unknown[]): Promise<SellerPayoutLine> {
		throw new MethodNotAllowedException(A_LINE_IS_RELEASED_BY_ITS_PAYOUT);
	}

	/**
	 * Refuses to restore an archived line: the lines a cancellation archived belong to a canceled payout,
	 * and restoring one would tie its transaction back to a payout that will never pay it.
	 */
	public async softRecover(..._args: unknown[]): Promise<SellerPayoutLine> {
		throw new MethodNotAllowedException(A_LINE_IS_RELEASED_BY_ITS_PAYOUT);
	}

	/** Refuses a payout that belongs to another seller. */
	private async assertPayoutScope(sellerPayoutId: ID, scope: ISellerScope): Promise<void> {
		const payout = await this.payoutRepository.findOne({
			where: { id: sellerPayoutId } as FindOptionsWhere<SellerPayout>
		});

		if (!payout) {
			throw new NotFoundException('The seller payout does not exist.');
		}

		if (payout.sellerId !== scope.sellerId) {
			throw new ForbiddenException(`This credential is not valid for seller '${payout.sellerId}'.`);
		}
	}
}
