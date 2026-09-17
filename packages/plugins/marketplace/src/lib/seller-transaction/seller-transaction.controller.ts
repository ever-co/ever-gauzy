import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	ID,
	IPagination,
	ISellerSplitReconciliation,
	PermissionsEnum,
	SellerHoldReason
} from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { SellerTransaction } from './seller-transaction.entity';
import { SellerTransactionService } from './seller-transaction.service';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';
import { ISellerScope } from '../seller-scope/seller-scope';

/**
 * The seller ledger surface.
 *
 * A ledger row is written by the order split and never by a caller, so this controller exposes reads and
 * two lifecycle acts — settling a row into a payout and holding one out of it. There is no create
 * route, because a route that could create a ledger row would be a route that could invent money.
 */
@ApiTags('SellerTransaction')
@UseGuards(TenantPermissionGuard, PermissionGuard, SellerAccessGuard)
@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_VIEW)
@Controller('/seller-transactions')
export class SellerTransactionController extends CrudController<SellerTransaction> {
	constructor(private readonly sellerTransactionService: SellerTransactionService) {
		super(sellerTransactionService);
	}

	/**
	 * Lists the per-seller split of orders.
	 *
	 * @param request The request, carrying the resolved seller scope.
	 * @param filter The query filter.
	 * @returns The page of ledger rows.
	 */
	@ApiOperation({ summary: 'List the per-seller split' })
	@ApiResponse({ status: 200, description: 'Transactions retrieved successfully', type: SellerTransaction })
	@Get('/')
	@UseValidationPipe({ transform: true })
	async findAll(
		@Req() request: any,
		@Query() filter: BaseQueryDTO<SellerTransaction>
	): Promise<IPagination<SellerTransaction>> {
		return this.sellerTransactionService.listTransactions(filter, this.scope(request));
	}

	/**
	 * The split reconciliation report.
	 *
	 * @param query The window and the optional seller or order.
	 * @returns The per-order reconciliation, whose `splitDelta` must be zero.
	 */
	@ApiOperation({ summary: 'Reconcile the split against the captured money' })
	@ApiResponse({ status: 200, description: 'Reconciliation produced successfully' })
	@Get('/reconciliation')
	async reconciliation(
		@Query('from') from?: string,
		@Query('to') to?: string,
		@Query('sellerId') sellerId?: ID,
		@Query('orderId') orderId?: ID,
		@Query('onlyMismatched') onlyMismatched?: string
	): Promise<IPagination<ISellerSplitReconciliation>> {
		return this.sellerTransactionService.reconcile({
			from: from ? new Date(from) : undefined,
			to: to ? new Date(to) : undefined,
			sellerId,
			orderId,
			onlyMismatched: onlyMismatched === 'true'
		});
	}

	/**
	 * Reads one ledger row with every amount of the split.
	 *
	 * @param request The request.
	 * @param id The row id.
	 * @returns The row.
	 */
	@ApiOperation({ summary: 'Read one seller transaction' })
	@ApiResponse({ status: 200, description: 'Transaction retrieved successfully', type: SellerTransaction })
	@Get('/:id')
	async findById(@Req() request: any, @Param('id', UUIDValidationPipe) id: ID): Promise<SellerTransaction> {
		return this.sellerTransactionService.getTransaction(id, this.scope(request));
	}

	/**
	 * Forces a row to settleable.
	 *
	 * @param id The row id.
	 * @param body The note.
	 * @returns The row, in `SETTLEABLE`.
	 */
	@ApiOperation({ summary: 'Force a transaction to settleable' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_SETTLE)
	@Post('/:id/settle')
	async settle(@Param('id', UUIDValidationPipe) id: ID, @Body() body: { note?: string }): Promise<SellerTransaction> {
		return this.sellerTransactionService.settle(id, body?.note);
	}

	/**
	 * Holds a row out of payouts.
	 *
	 * @param id The row id.
	 * @param body The reason and the note.
	 * @returns The row, in `HELD`.
	 */
	@ApiOperation({ summary: 'Hold a transaction out of payouts' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_SETTLE)
	@Post('/:id/hold')
	async hold(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: { reason: SellerHoldReason; note?: string }
	): Promise<SellerTransaction> {
		return this.sellerTransactionService.hold(id, body?.reason, body?.note);
	}

	/**
	 * The seller scope the guard resolved.
	 *
	 * @param request The request.
	 * @returns The scope, when the request carries one.
	 */
	private scope(request: any): ISellerScope | undefined {
		return request?.sellerScope as ISellerScope | undefined;
	}
}
