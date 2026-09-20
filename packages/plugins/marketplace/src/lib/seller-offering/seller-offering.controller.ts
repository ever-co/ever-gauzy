import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
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
import { SellerOffering } from './seller-offering.entity';
import { SellerOfferingService } from './seller-offering.service';
import { CreateSellerOfferingDTO, UpdateSellerOfferingDTO } from './dto';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';
import { ISellerScope } from '../seller-scope/seller-scope';

/**
 * The offering surface: author, submit, publish, pause and withdraw.
 *
 * A seller acts on its own offerings through the same routes staff use; what differs is the scope, and
 * the scope is what the access guard resolves and every service method takes as its first argument.
 */
@ApiTags('SellerOffering')
@UseGuards(TenantPermissionGuard, PermissionGuard, SellerAccessGuard)
@Permissions(PermissionsEnum.SELLER_OFFERINGS_VIEW)
@Controller('/seller-offerings')
export class SellerOfferingController extends CrudController<SellerOffering> {
	constructor(private readonly sellerOfferingService: SellerOfferingService) {
		super(sellerOfferingService);
	}

	/** Lists the offerings the caller may see. */
	@ApiOperation({ summary: 'List offerings' })
	@ApiResponse({ status: 200, description: 'Offerings retrieved successfully', type: SellerOffering })
	@Get('/')
	@UseValidationPipe({ transform: true })
	async findAll(@Req() request: any, @Query() filter: BaseQueryDTO<SellerOffering>): Promise<IPagination<SellerOffering>> {
		return this.sellerOfferingService.listOfferings(filter, this.scope(request));
	}

	/** Reads one offering with its publication state. */
	@ApiOperation({ summary: 'Read one offering' })
	@ApiResponse({ status: 200, description: 'Offering retrieved successfully', type: SellerOffering })
	@Get('/:id')
	async findById(@Req() request: any, @Param('id', UUIDValidationPipe) id: ID): Promise<SellerOffering> {
		return this.sellerOfferingService.getOffering(id, this.scope(request));
	}

	/**
	 * Offers a variant.
	 *
	 * Declared rather than inherited: a request body is validated from the type the handler names, and the
	 * base class names the entity's shape, whose reflected type is `Object` — a parameter the validation
	 * pipe skips, so an inherited `create` would write any body at all.
	 *
	 * `seller_offering.create` is adopted as retry-safe without requiring a key: a seller that re-sends an
	 * offer it never saw acknowledged is answered with the offering the first attempt created rather than
	 * with the collision the same variant causes. The key stays optional because one seller may offer one
	 * variant once, so the second write is already refused.
	 */
	@ApiOperation({ summary: 'Offer a variant' })
	@ApiResponse({ status: 201, description: 'Offering created successfully', type: SellerOffering })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	@Idempotent({ scope: 'seller_offering.create', required: false, resourceType: 'seller_offering' })
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Req() request: any, @Body() entity: CreateSellerOfferingDTO): Promise<SellerOffering> {
		return this.sellerOfferingService.createOffering(entity as Partial<SellerOffering>, this.scope(request));
	}

	/** Updates an offering. */
	@ApiOperation({ summary: 'Update an offering' })
	@ApiResponse({ status: 200, description: 'Offering updated successfully', type: SellerOffering })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateSellerOfferingDTO,
		@Req() request: any
	): Promise<SellerOffering> {
		return this.sellerOfferingService.updateOffering(id, entity as Partial<SellerOffering>, this.scope(request));
	}

	/** Submits an offering for moderation. */
	@ApiOperation({ summary: 'Submit an offering for moderation' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	@Post('/:id/submit')
	async submit(@Req() request: any, @Param('id', UUIDValidationPipe) id: ID): Promise<SellerOffering> {
		return this.sellerOfferingService.submit(id, this.scope(request));
	}

	/**
	 * Publishes an offering, optionally to a channel subset.
	 *
	 * `seller_offering.publish` is adopted as retry-safe without requiring a key: publishing twice
	 * re-stamps the approval and announces a second publication of an offering that is already live, so
	 * a client that presents a key is answered from its first attempt instead. The key stays optional
	 * because the second write otherwise converges on the same `ACTIVE` state.
	 */
	@ApiOperation({ summary: 'Publish an offering' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	@Idempotent({ scope: 'seller_offering.publish', required: false, resourceType: 'seller_offering' })
	@Post('/:id/publish')
	async publish(
		@Req() request: any,
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: { channelIds?: string[] }
	): Promise<SellerOffering> {
		return this.sellerOfferingService.publish(id, body?.channelIds, this.scope(request));
	}

	/** Pauses an offering without withdrawing it. */
	@ApiOperation({ summary: 'Pause an offering' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	@Post('/:id/unpublish')
	async unpublish(@Req() request: any, @Param('id', UUIDValidationPipe) id: ID): Promise<SellerOffering> {
		return this.sellerOfferingService.unpause(id, this.scope(request));
	}

	/** Replaces the offering's channel and region publication sets. */
	@ApiOperation({ summary: 'Replace the offering publication sets' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	@Put('/:id/channels')
	async channels(
		@Req() request: any,
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: { channelIds?: string[]; regionIds?: string[] }
	): Promise<SellerOffering> {
		return this.sellerOfferingService.setChannelSets(id, body ?? {}, this.scope(request));
	}

	/** Withdraws an offering. The row is kept: it explains a past line's price and commission. */
	@ApiOperation({ summary: 'Withdraw an offering' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	@Delete('/:id')
	async withdraw(@Req() request: any, @Param('id', UUIDValidationPipe) id: ID): Promise<SellerOffering> {
		return this.sellerOfferingService.withdraw(id, this.scope(request));
	}

	/** The seller scope the guard resolved. */
	private scope(request: any): ISellerScope | undefined {
		return request?.sellerScope as ISellerScope | undefined;
	}
}
