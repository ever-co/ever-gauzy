import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { SubscriptionFeatures } from '../subscription.features';
import { SubscriptionPermissions } from '../subscription.permissions';
import { CreateSubscriptionItemDTO, UpdateSubscriptionItemDTO } from './dto';
import { SubscriptionItem } from './subscription-item.entity';
import { SubscriptionItemService } from './subscription-item.service';
import { SubscriptionService } from '../subscription/subscription.service';

/**
 * Recurring lines.
 *
 * The controller is the line set's own surface: reading what a subscription bills, and correcting a
 * line's quantity or price. A change that has a *price consequence for the current period* belongs to
 * the subscription's own routes instead — `/subscriptions/:id/items` and its siblings — because the
 * proration is arithmetic over the subscription's period, and a caller that had to reproduce it would
 * one day reproduce it differently.
 */
@ApiTags('SubscriptionItem')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(SubscriptionFeatures.SUBSCRIPTION)
@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
@Controller('/subscription-items')
export class SubscriptionItemController extends CrudController<SubscriptionItem> {
	constructor(
		private readonly subscriptionItemService: SubscriptionItemService,
		private readonly subscriptionService: SubscriptionService
	) {
		super(subscriptionItemService);
	}

	/**
	 * Adds a recurring line without settling a proration.
	 *
	 * @param entity The line.
	 * @returns The created line.
	 */
	@ApiOperation({ summary: 'Add a recurring line' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The line was added.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateSubscriptionItemDTO): Promise<SubscriptionItem> {
		const subscription = await this.subscriptionService.findOneScoped(entity.subscriptionId);

		return await this.subscriptionItemService.addItem(
			entity.subscriptionId,
			entity as any,
			subscription.currency,
			subscription.customerId
		);
	}

	/**
	 * Updates a recurring line.
	 *
	 * @param id The line to update.
	 * @param entity The fields to change.
	 * @returns The updated line.
	 */
	@ApiOperation({ summary: 'Update a recurring line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was updated.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateSubscriptionItemDTO): Promise<SubscriptionItem> {
		await this.subscriptionItemService.update(id, entity as any);

		return await this.subscriptionItemService.findOneScoped(id);
	}

	/**
	 * Removes a recurring line, preserving the row as history.
	 *
	 * @param id The line to remove.
	 * @returns Nothing.
	 */
	@ApiOperation({ summary: 'Remove a recurring line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was removed.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		await this.subscriptionItemService.softDelete(id);
	}

	/**
	 * Reads a recurring line.
	 *
	 * @param id The line to read.
	 * @returns The line.
	 */
	@ApiOperation({ summary: 'Find a recurring line by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The line was found.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<SubscriptionItem> {
		return await this.subscriptionItemService.findOneScoped(id);
	}

	/**
	 * Lists recurring lines.
	 *
	 * @param options The filter, including `filter[subscriptionId]` and `filter[variantId]`.
	 * @returns The lines, paginated.
	 */
	@ApiOperation({ summary: 'List recurring lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The lines were listed.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<SubscriptionItem>): Promise<IPagination<SubscriptionItem>> {
		return await this.subscriptionItemService.findAll(options);
	}
}
