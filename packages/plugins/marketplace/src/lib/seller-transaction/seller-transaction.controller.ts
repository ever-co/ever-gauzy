import {
	Body,
	Controller,
	Get,
	MethodNotAllowedException,
	Param,
	Post,
	Put,
	Query,
	Req,
	UseGuards
} from '@nestjs/common';
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
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { SellerTransaction } from './seller-transaction.entity';
import { SellerTransactionService } from './seller-transaction.service';
import { CreateSellerTransactionDTO, UpdateSellerTransactionDTO } from './dto';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';
import { ISellerScope } from '../seller-scope/seller-scope';

/** What the create route answers with, because a caller never authors a ledger row. */
const A_LEDGER_ROW_IS_WRITTEN_BY_THE_ORDER_SPLIT =
	'A ledger row is written by the order split inside the order transaction; a caller never authors one.';

/** What the update route answers with, because a caller never moves a ledger amount. */
const A_LEDGER_ROW_MOVES_THROUGH_ITS_OWN_ENDPOINTS =
	'A ledger row is advanced by its settle and hold endpoints; its amounts are append only.';

/**
 * The seller ledger surface.
 *
 * A ledger row is written by the order split and never by a caller, so this controller exposes reads and
 * two lifecycle acts — settling a row into a payout and holding one out of it. Its create and update
 * routes are declared and refuse: a route that could create or re-amount a ledger row would be a route
 * that could invent money, and declaring them is what keeps the endpoint addressable and validated
 * instead of inheriting an unvalidated one from the CRUD base.
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
	 * Refuses a caller-authored ledger row.
	 *
	 * Declared rather than inherited: an inherited `create` names the entity's shape, a type that reflects
	 * as `Object`, which the validation pipe skips — so any body at all would reach the service. The body
	 * is named as a DTO so that the request is validated, and the route then refuses it.
	 *
	 * @param entity The row a caller tried to author.
	 * @returns Nothing: the route always throws.
	 */
	@ApiOperation({ summary: 'Refuse a caller-authored ledger row' })
	@ApiResponse({ status: 405, description: 'A ledger row is written by the order split, not by a caller' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_SETTLE)
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateSellerTransactionDTO): Promise<SellerTransaction> {
		throw new MethodNotAllowedException(A_LEDGER_ROW_IS_WRITTEN_BY_THE_ORDER_SPLIT);
	}

	/**
	 * Refuses a caller-authored edit of a ledger row.
	 *
	 * What a row may move is its status and its hold reason, and both move through the settle and hold
	 * endpoints, which is where the rule that no amount is writable is enforced.
	 *
	 * @param id The row id.
	 * @param entity The fields a caller tried to change.
	 * @returns Nothing: the route always throws.
	 */
	@ApiOperation({ summary: 'Refuse a caller-authored edit of a ledger row' })
	@ApiResponse({ status: 405, description: 'A ledger row is advanced by its own endpoints, not by an update' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_SETTLE)
	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateSellerTransactionDTO
	): Promise<SellerTransaction> {
		throw new MethodNotAllowedException(A_LEDGER_ROW_MOVES_THROUGH_ITS_OWN_ENDPOINTS);
	}

	/**
	 * Forces a row to settleable.
	 *
	 * `seller.transaction.settle` is adopted as retry-safe without requiring a key: a caller that
	 * re-sends an advance it never saw acknowledged would announce the row's release a second time and
	 * move its settleable date, so a client that presents a key is answered from its first attempt
	 * instead. The key stays optional because the row is advanced, never re-amounted, so the second
	 * write converges on the same status.
	 *
	 * @param id The row id.
	 * @param body The note.
	 * @returns The row, in `SETTLEABLE`.
	 */
	@ApiOperation({ summary: 'Force a transaction to settleable' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_SETTLE)
	@Idempotent({ scope: 'seller.transaction.settle', required: false, resourceType: 'seller_transaction' })
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
