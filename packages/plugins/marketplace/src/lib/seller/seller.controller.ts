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
	Idempotent,
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
	 * @param request The request.
	 * @param idOrCode The seller id or code.
	 * @returns The seller.
	 */
	@ApiOperation({ summary: 'Read one seller account' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Seller retrieved successfully', type: Seller })
	@Get('/:idOrCode')
	async findOne(@Req() request: any, @Param('idOrCode') idOrCode: string): Promise<Seller> {
		return this.sellerService.getSeller(idOrCode, this.scope(request));
	}

	/**
	 * Creates a seller account on the seller's behalf.
	 *
	 * `seller.create` is adopted as retry-safe without requiring a key: an applicant that re-sends an
	 * application it never saw acknowledged is answered with the seller the first attempt created rather
	 * than with the collision its own code causes. The key stays optional because the organization's own
	 * uniqueness on the code already refuses the second row, so a client that presents no key is served
	 * exactly as it was before.
	 *
	 * @param entity The seller to create.
	 * @returns The created seller.
	 */
	@ApiOperation({ summary: 'Create a seller account' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Seller created successfully', type: Seller })
	@Permissions(PermissionsEnum.SELLERS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Idempotent({ scope: 'seller.create', required: false, resourceType: 'seller' })
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
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateSellerDTO,
		@Req() request: any
	): Promise<Seller> {
		return this.sellerService.updateSeller(id, entity as Partial<Seller>, this.scope(request));
	}

	/**
	 * Submits a draft application for review.
	 *
	 * @param request The request.
	 * @param id The seller id.
	 * @returns The seller, in `SUBMITTED`.
	 */
	@ApiOperation({ summary: 'Submit a seller application for review' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	@Post('/:id/submit')
	async submit(@Req() request: any, @Param('id', UUIDValidationPipe) id: ID): Promise<Seller> {
		return this.sellerService.submit(id, this.scope(request));
	}

	/**
	 * Records one verification kind's result.
	 *
	 * `seller.verify` is adopted as retry-safe without requiring a key: a verifier that re-sends a
	 * verdict it never saw acknowledged would stamp a fresh verification date over the one already
	 * recorded, so a client that presents a key is answered from its first attempt instead. The key
	 * stays optional because a repeated verdict converges on the same status either way.
	 *
	 * @param id The seller id.
	 * @param body The verification result.
	 * @returns The seller with its verification statuses.
	 */
	@ApiOperation({ summary: 'Record a verification result' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	@Idempotent({ scope: 'seller.verify', required: false, resourceType: 'seller' })
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
	 * @param request The request.
	 * @param id The seller id.
	 * @returns The seller, in `ACTIVE`.
	 */
	@ApiOperation({ summary: 'Activate an approved seller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	@Post('/:id/activate')
	async activate(@Req() request: any, @Param('id', UUIDValidationPipe) id: ID): Promise<Seller> {
		return this.sellerService.activate(id, this.scope(request));
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
	async suspend(
		@Req() request: any,
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: { reason: string }
	): Promise<Seller> {
		return this.sellerService.suspend(id, body?.reason, this.scope(request));
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
	async reinstate(@Req() request: any, @Param('id', UUIDValidationPipe) id: ID): Promise<Seller> {
		return this.sellerService.reinstate(id, this.scope(request));
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
	 * `seller.offboard` is adopted as retry-safe without requiring a key: the move is a lifecycle
	 * transition, so a second attempt is refused by the state machine rather than applied twice, and
	 * answering it from the first attempt's record is the more useful of the two answers. The key stays
	 * optional because a client that presents none is already protected by that refusal.
	 *
	 * @param id The seller id.
	 * @returns The seller, in `OFFBOARDING`.
	 */
	@ApiOperation({ summary: 'Start offboarding a seller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	@Idempotent({ scope: 'seller.offboard', required: false, resourceType: 'seller' })
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
		@Req() request: any,
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('currency') currency?: string
	): Promise<ISellerBalance> {
		// The scope is enforced on the read of the seller rather than on the figure: a balance is summed
		// from the seller's own ledger rows, so a caller that may not read the seller may not read the sum
		// either, and refusing at the row is what keeps the two answers from diverging.
		const seller = await this.sellerService.getSeller(id, this.scope(request));

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
