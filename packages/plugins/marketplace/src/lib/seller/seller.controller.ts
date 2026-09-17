import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	ID,
	IPagination,
	ISellerBalance,
	ISellerStatement,
	PermissionsEnum,
	SellerVerificationKind,
	SellerVerificationStatus
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
import { Seller } from './seller.entity';
import { SellerService } from './seller.service';
import { CreateSellerDTO, SellerDTO, UpdateSellerDTO } from './dto';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';
import { ISellerScope } from '../seller-scope/seller-scope';

/**
 * The seller surface.
 *
 * There is one API surface and this is it: no operator prefix and no seller prefix, because a
 * separate path per audience is how the same rule ends up enforced twice and differently. The caller's
 * scope is what differs, and the seller access guard resolves it and attaches it to the request.
 */
@ApiTags('Seller')
@UseGuards(TenantPermissionGuard, PermissionGuard, SellerAccessGuard)
@Permissions(PermissionsEnum.SELLERS_VIEW)
@Controller('/sellers')
export class SellerController extends CrudController<Seller> {
	constructor(private readonly sellerService: SellerService) {
		super(sellerService);
	}

	/**
	 * Lists the seller accounts the caller may see.
	 *
	 * @param filter The query filter.
	 * @returns The page of sellers.
	 */
	@ApiOperation({ summary: 'List seller accounts' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Sellers retrieved successfully', type: Seller })
	@Get('/')
	@UseValidationPipe({ transform: true })
	async findAll(@Req() request: any, @Query() filter: BaseQueryDTO<Seller>): Promise<IPagination<Seller>> {
		return this.sellerService.listSellers(filter, this.scope(request));
	}

	/**
	 * Reads one seller, by id or by its code.
	 *
	 * @param idOrCode The seller id or code.
	 * @returns The seller.
	 */
	@ApiOperation({ summary: 'Read one seller account' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Seller retrieved successfully', type: Seller })
	@Get('/:idOrCode')
	async findOne(@Param('idOrCode') idOrCode: string): Promise<Seller> {
		return this.sellerService.getSeller(idOrCode);
	}

	/**
	 * Creates a seller account on the seller's behalf.
	 *
	 * @param entity The seller to create.
	 * @returns The created seller.
	 */
	@ApiOperation({ summary: 'Create a seller account' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Seller created successfully', type: Seller })
	@Permissions(PermissionsEnum.SELLERS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateSellerDTO): Promise<Seller> {
		return this.sellerService.createSeller(entity as Partial<Seller>);
	}

	/**
	 * Updates the profile, the commission defaults, the payout terms and the tax identifiers.
	 *
	 * @param id The seller id.
	 * @param entity The fields to change.
	 * @returns The updated seller.
	 */
	@ApiOperation({ summary: 'Update a seller account' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Seller updated successfully', type: Seller })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Req() request: any,
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateSellerDTO
	): Promise<Seller> {
		return this.sellerService.updateSeller(id, entity as Partial<Seller>, this.scope(request));
	}

	/**
	 * Submits a draft application for review.
	 *
	 * @param id The seller id.
	 * @returns The seller, in `SUBMITTED`.
	 */
	@ApiOperation({ summary: 'Submit a seller application for review' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	@Post('/:id/submit')
	async submit(@Param('id', UUIDValidationPipe) id: ID): Promise<Seller> {
		return this.sellerService.submit(id);
	}

	/**
	 * Records one verification kind's result.
	 *
	 * @param id The seller id.
	 * @param body The verification result.
	 * @returns The seller with its verification statuses.
	 */
	@ApiOperation({ summary: 'Record a verification result' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	@Post('/:id/verify')
	@UseValidationPipe({ transform: true })
	async verify(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body()
		body: {
			kind: SellerVerificationKind;
			status: SellerVerificationStatus;
			reference?: string;
			provider?: string;
			expiresAt?: Date;
			note?: string;
		}
	): Promise<Seller> {
		return this.sellerService.verify(id, body);
	}

	/**
	 * Activates an approved seller, which is the only act that lets it trade.
	 *
	 * @param id The seller id.
	 * @returns The seller, in `ACTIVE`.
	 */
	@ApiOperation({ summary: 'Activate an approved seller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	@Post('/:id/activate')
	async activate(@Param('id', UUIDValidationPipe) id: ID): Promise<Seller> {
		return this.sellerService.activate(id);
	}

	/**
	 * Suspends a seller: no new orders, balances held, everything already placed untouched.
	 *
	 * @param id The seller id.
	 * @param body The reason.
	 * @returns The seller, in `SUSPENDED`.
	 */
	@ApiOperation({ summary: 'Suspend a seller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	@Post('/:id/suspend')
	async suspend(@Param('id', UUIDValidationPipe) id: ID, @Body() body: { reason: string }): Promise<Seller> {
		return this.sellerService.suspend(id, body?.reason);
	}

	/**
	 * Returns a suspended seller to `ACTIVE`. Its offerings stay paused.
	 *
	 * @param id The seller id.
	 * @returns The seller, in `ACTIVE`.
	 */
	@ApiOperation({ summary: 'Reinstate a suspended seller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	@Post('/:id/reinstate')
	async reinstate(@Param('id', UUIDValidationPipe) id: ID): Promise<Seller> {
		return this.sellerService.reinstate(id);
	}

	/**
	 * Refuses an application.
	 *
	 * @param id The seller id.
	 * @param body The reason.
	 * @returns The seller, in `REJECTED`.
	 */
	@ApiOperation({ summary: 'Reject a seller application' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	@Post('/:id/reject')
	async reject(@Param('id', UUIDValidationPipe) id: ID, @Body() body: { reason: string }): Promise<Seller> {
		return this.sellerService.reject(id, body?.reason);
	}

	/**
	 * Starts winding a seller down.
	 *
	 * @param id The seller id.
	 * @returns The seller, in `OFFBOARDING`.
	 */
	@ApiOperation({ summary: 'Start offboarding a seller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	@Post('/:id/offboard')
	async offboard(@Param('id', UUIDValidationPipe) id: ID): Promise<Seller> {
		return this.sellerService.startOffboarding(id);
	}

	/**
	 * The seller's statement: every ledger row, every payout, every settlement and the closing balance.
	 *
	 * @param id The seller id.
	 * @param query The period and currency.
	 * @returns The statement.
	 */
	@ApiOperation({ summary: 'Read a seller statement' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Statement retrieved successfully' })
	@Get('/:id/statement')
	async statement(
		@Req() request: any,
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('from') from?: string,
		@Query('to') to?: string,
		@Query('currency') currency?: string
	): Promise<ISellerStatement> {
		return this.sellerService.getStatement(
			id,
			{ from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined, currency },
			this.scope(request)
		);
	}

	/**
	 * The seller's balance in one currency.
	 *
	 * @param id The seller id.
	 * @param query The currency.
	 * @returns The balance.
	 */
	@ApiOperation({ summary: 'Read a seller balance' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Balance retrieved successfully' })
	@Get('/:id/balance')
	async balance(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('currency') currency?: string
	): Promise<ISellerBalance> {
		const seller = await this.sellerService.getSeller(id);

		return this.sellerService.getBalance(seller, currency ?? seller.payoutCurrency ?? 'USD');
	}

	/**
	 * The seller scope the guard resolved for this request.
	 *
	 * Read from the request rather than from a thread-local: the scope is a property of the call, and
	 * the guard is what put it there.
	 *
	 * @param request The request.
	 * @returns The scope, when the request carries one.
	 */
	private scope(request: any): ISellerScope | undefined {
		return request?.sellerScope as ISellerScope | undefined;
	}
}
