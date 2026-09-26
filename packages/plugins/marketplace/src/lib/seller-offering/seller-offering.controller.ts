import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	Req,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	ApiErrorCode,
	ApiException,
	BaseQueryDTO,
	BulkExecutor,
	BulkItemResult,
	BulkOperation,
	BulkResult,
	CrudController,
	IBulkItemContext,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe,
	bulkOptionsOf
} from '@gauzy/core';
import type { BulkItemRequest } from '@gauzy/core';
import { SellerOffering } from './seller-offering.entity';
import { SellerOfferingService } from './seller-offering.service';
import { CreateSellerOfferingDTO, UpdateSellerOfferingDTO } from './dto';
import {
	IBulkSellerOfferingItem,
	IBulkSellerOfferingsRequest,
	SELLER_OFFERING_BULK_REQUIRED_KEYS
} from './seller-offering.bulk';
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
	constructor(
		private readonly sellerOfferingService: SellerOfferingService,
		private readonly bulkExecutor: BulkExecutor
	) {
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

	/**
	 * Applies a batch of offerings.
	 *
	 * One request publishes, pauses, withdraws or re-prices a page of listings and answers one outcome per
	 * item: what applied, what did not and the counts derived from both. The batch itself is the
	 * platform's — `@BulkOperation` declares what this route accepts, the executor is configured from
	 * that declaration, and it authorises the whole request once, refuses a batch it cannot read before
	 * writing anything, and rolls an atomic batch back when one of its items fails. A second runner
	 * beside that one would be a second answer to the same question, which is what the platform's bulk
	 * contract exists to prevent.
	 *
	 * The items are applied through the service that owns the offering's writes, with the batch's own
	 * transactional manager, so an atomic batch is one transaction over the same methods the single-item
	 * routes reach and an item produces the same row, the same event and the same refusal.
	 *
	 * `atomic` is the whole point of the flag: an atomic batch applies every item or none of them, and a
	 * batch that is not atomic applies what it can and reports the rest.
	 *
	 * The caller's seller scope is resolved once by the guard and handed to every item, so a seller-scoped
	 * caller reaches its own offerings and no others — the refusal the single-item routes give for
	 * another seller's offering is the refusal its item reports.
	 *
	 * The route declares no body type: the batch's own checks — the cap, the unreadable item, the member
	 * an item does not carry — belong to the executor, so a validation pipe here could only refuse a
	 * request the contract already refuses, in a second vocabulary.
	 *
	 * @param request The HTTP request, which carries the seller scope the guard resolved.
	 * @param body The batch.
	 * @returns What applied, what did not, and the counts derived from both.
	 */
	@ApiOperation({ summary: 'Publish, pause, withdraw and re-price offerings in bulk' })
	@ApiResponse({
		status: 200,
		description: 'The batch was applied, with one outcome per item'
	})
	@ApiResponse({
		status: 400,
		description: 'The request or an item could not be read'
	})
	@ApiResponse({
		status: 409,
		description: 'An atomic batch was refused whole, naming the item that failed'
	})
	@ApiResponse({
		status: 413,
		description: 'BULK_LIMIT_EXCEEDED'
	})
	@ApiResponse({
		status: 422,
		description: 'BULK_ALL_ITEMS_FAILED'
	})
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	@Idempotent({ scope: 'seller_offering.bulk', required: false, resourceType: 'seller_offering' })
	@BulkOperation({
		resource: 'seller_offering',
		// The platform's cap for every resource but the price and stock matrices, whose batches are larger.
		maxItems: 200,
		permission: PermissionsEnum.SELLER_OFFERINGS_EDIT
	})
	@Post('/bulk')
	async bulk(
		@Req() request: any,
		@Body() body: IBulkSellerOfferingsRequest
	): Promise<BulkResult<IBulkSellerOfferingItem>> {
		this.assertNoDryRun(body);

		const scope = this.scope(request);

		return await this.bulkExecutor.execute<IBulkSellerOfferingItem>(
			body,
			(item, context) => this.applyBulkItem(item, context, scope),
			bulkOptionsOf(SellerOfferingController, 'bulk', {
				requiredKeys: SELLER_OFFERING_BULK_REQUIRED_KEYS,
				transaction: this.sellerOfferingService.transaction
			})
		);
	}

	/**
	 * DELETE an offering by id
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to that empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler stood on this
	 * controller's class-level view grant alone. This override exists only to state its permission: the path
	 * and the body are the base class's, and an offering is a child row of the seller, so deleting one takes
	 * SELLERS_DELETE, the DELETE value the catalogue declares for the seller it hangs off.
	 *
	 * @param id The offering id.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete an offering' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Offering deleted successfully' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE an offering by id
	 *
	 * The route belongs to `CrudController.softRemove()`, which declares it with no permission metadata at
	 * all, so `PermissionGuard` answers `true` to the empty metadata — the `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — and only this controller's class-level view
	 * grant was left in front of it. This override exists only to state its permission: the route and its
	 * body are unchanged, and archiving a child row of the seller takes SELLERS_DELETE.
	 *
	 * @param id The offering id.
	 * @returns The soft-deleted offering.
	 */
	@ApiOperation({ summary: 'Soft delete an offering' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Offering soft deleted successfully' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted offering by id
	 *
	 * The route belongs to `CrudController.softRecover()` and carries no permission metadata of its own, so
	 * `PermissionGuard` answers `true` to the empty metadata — the `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — before it consults the role grants at all.
	 * This override exists only to state its permission on the same path and the same body: restoring a row
	 * under the seller takes SELLERS_DELETE, the same destructive grant its deletion takes.
	 *
	 * @param id The offering id.
	 * @returns The restored offering.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted offering' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Offering restored successfully' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}

	/**
	 * Refuses a batch that asks for a dry run.
	 *
	 * This route declares no dry run, and the platform's executor would honour the member anyway: it would
	 * apply every item with no transaction, so a request that asked the batch to be validated and priced
	 * without being written would be answered with the writes it asked not to make. Refusing is the honest
	 * answer to a member the endpoint table does not declare for this route, and it is refused before item
	 * 0 so nothing is applied.
	 *
	 * The member is read off the body rather than off the declared type because the route declares no body
	 * type: a REST caller reaches the handler with whatever the request carried.
	 *
	 * @param body The batch.
	 * @throws ApiException When the batch carries the undeclared member.
	 */
	private assertNoDryRun(body: IBulkSellerOfferingsRequest): void {
		if ((body as { dryRun?: unknown })?.dryRun !== undefined) {
			throw new ApiException(
				400,
				ApiErrorCode.VALIDATION_FAILED,
				'This route applies every item it accepts; it declares no dry run.',
				{ field: 'dryRun' }
			);
		}
	}

	/**
	 * Applies one item of a batch through the service that owns the offering's writes.
	 *
	 * The route owns no write of its own: the item is handed on with the batch's transactional manager
	 * exactly as the executor resolved it and with the scope the guard resolved, and the outcome names the
	 * offering that moved so a client can match an answer to the listing it asked about.
	 *
	 * @param item The item.
	 * @param context What the executor resolved for it.
	 * @param scope The seller scope the guard resolved, when the caller is seller-scoped.
	 * @returns The outcome the batch reports for the item.
	 */
	private async applyBulkItem(
		item: BulkItemRequest<IBulkSellerOfferingItem>,
		context: IBulkItemContext,
		scope?: ISellerScope
	): Promise<BulkItemResult> {
		const offering = await this.sellerOfferingService.applyBulkItem(item, scope, context.manager);

		return { index: context.index, id: offering.id };
	}

	/** The seller scope the guard resolved. */
	private scope(request: any): ISellerScope | undefined {
		return request?.sellerScope as ISellerScope | undefined;
	}
}
