import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, ISellerPayoutRunResult, PermissionsEnum } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { SellerPayout } from './seller-payout.entity';
import { SellerPayoutService } from './seller-payout.service';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';
import { ISellerScope } from '../seller-scope/seller-scope';

/**
 * The payout surface: build, run, approve, execute and cancel.
 *
 * Approving is a separate permission from creating, because creating a payout is preparation and
 * approving one moves money — a tenant that wants four-eyes control assigns the two to different roles.
 */
@ApiTags('SellerPayout')
@UseGuards(TenantPermissionGuard, PermissionGuard, SellerAccessGuard)
@Permissions(PermissionsEnum.SELLER_PAYOUTS_VIEW)
@Controller('/seller-payouts')
export class SellerPayoutController extends CrudController<SellerPayout> {
	constructor(private readonly sellerPayoutService: SellerPayoutService) {
		super(sellerPayoutService);
	}

	/**
	 * Lists payouts.
	 *
	 * @param request The request.
	 * @param filter The query filter.
	 * @returns The page of payouts.
	 */
	@ApiOperation({ summary: 'List payouts' })
	@ApiResponse({ status: 200, description: 'Payouts retrieved successfully', type: SellerPayout })
	@Get('/')
	@UseValidationPipe({ transform: true })
	async findAll(@Req() request: any, @Query() filter: BaseQueryDTO<SellerPayout>): Promise<IPagination<SellerPayout>> {
		return this.sellerPayoutService.listPayouts(filter, this.scope(request));
	}

	/**
	 * Reads one payout with its lines.
	 *
	 * @param request The request.
	 * @param id The payout id.
	 * @returns The payout.
	 */
	@ApiOperation({ summary: 'Read one payout with its lines' })
	@ApiResponse({ status: 200, description: 'Payout retrieved successfully', type: SellerPayout })
	@Get('/:id')
	async findById(@Req() request: any, @Param('id', UUIDValidationPipe) id: ID): Promise<SellerPayout> {
		return this.sellerPayoutService.getPayout(id, this.scope(request));
	}

	/**
	 * Creates a payout from settleable transactions.
	 *
	 * @param request The request.
	 * @param body What to pay.
	 * @returns The created payout.
	 */
	@ApiOperation({ summary: 'Create a payout from settleable transactions' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_CREATE)
	@Post('/')
	@UseValidationPipe({ transform: true })
	async create(
		@Req() request: any,
		@Body()
		body: {
			sellerId: ID;
			currency: string;
			transactionIds?: ID[];
			periodStart?: string;
			periodEnd?: string;
			note?: string;
			isFinal?: boolean;
		}
	): Promise<SellerPayout> {
		return this.sellerPayoutService.createPayout(
			{
				sellerId: body.sellerId,
				currency: body.currency,
				transactionIds: body.transactionIds,
				periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
				periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
				note: body.note,
				isFinal: body.isFinal
			},
			this.scope(request)
		);
	}

	/**
	 * Runs the payout pass for the sellers whose schedule is due.
	 *
	 * @param body The period and the optional sellers, currency and dry-run flag.
	 * @returns What the run decided for each seller.
	 */
	@ApiOperation({ summary: 'Run the scheduled payout pass' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_CREATE)
	@Post('/run')
	@UseValidationPipe({ transform: true })
	async run(
		@Body()
		body: {
			periodStart?: string;
			periodEnd?: string;
			sellerIds?: ID[];
			currency?: string;
			dryRun?: boolean;
		}
	): Promise<ISellerPayoutRunResult[]> {
		return this.sellerPayoutService.run({
			periodStart: body?.periodStart ? new Date(body.periodStart) : undefined,
			periodEnd: body?.periodEnd ? new Date(body.periodEnd) : undefined,
			sellerIds: body?.sellerIds,
			currency: body?.currency,
			dryRun: body?.dryRun === true
		});
	}

	/**
	 * Approves a payout.
	 *
	 * @param id The payout id.
	 * @returns The payout, in `APPROVED`.
	 */
	@ApiOperation({ summary: 'Approve a payout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_APPROVE)
	@Post('/:id/approve')
	async approve(@Param('id', UUIDValidationPipe) id: ID): Promise<SellerPayout> {
		return this.sellerPayoutService.approve(id);
	}

	/**
	 * Records the provider's execution of a payout.
	 *
	 * @param id The payout id.
	 * @param body What the provider reported.
	 * @returns The payout, in `PAID` or `FAILED`.
	 */
	@ApiOperation({ summary: 'Execute a payout through the provider' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_APPROVE)
	@Post('/:id/pay')
	@UseValidationPipe({ transform: true })
	async pay(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body()
		body: {
			paid: boolean;
			providerKey?: string;
			providerTransferId?: string;
			feeAmount?: string;
			failureCode?: string;
			failureReason?: string;
		}
	): Promise<SellerPayout> {
		return this.sellerPayoutService.recordExecution(id, body);
	}

	/**
	 * Cancels an unpaid payout and releases its transactions.
	 *
	 * @param id The payout id.
	 * @param body The reason.
	 * @returns The payout and the number of released rows.
	 */
	@ApiOperation({ summary: 'Cancel an unpaid payout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_CANCEL)
	@Post('/:id/cancel')
	async cancel(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: { reason: string }
	): Promise<{ payout: SellerPayout; releasedTransactionCount: number }> {
		return this.sellerPayoutService.cancel(id, body?.reason);
	}

	/**
	 * Re-drives a failed payout.
	 *
	 * @param id The payout id.
	 * @returns The payout, in `APPROVED`.
	 */
	@ApiOperation({ summary: 'Retry a failed payout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_APPROVE)
	@Post('/:id/retry')
	async retry(@Param('id', UUIDValidationPipe) id: ID): Promise<SellerPayout> {
		return this.sellerPayoutService.retry(id);
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
