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
import { CreateSubscriptionPlanDTO, UpdateSubscriptionPlanDTO } from './dto';
import { SubscriptionPlan } from './subscription-plan.entity';
import { SubscriptionPlanService } from './subscription-plan.service';

/**
 * Subscription plans.
 *
 * The CRUD surface a plan shares with every other resource is inherited; what is declared here is what
 * a plan is read and written for. A plan is the tenant's catalogue of what may be subscribed to, so
 * the list is the entry point, `code` is the practical lookup key, and deactivation is a soft delete:
 * the subscriptions already on a plan keep billing, and the plan row is what their history points at.
 */
@ApiTags('SubscriptionPlan')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(SubscriptionFeatures.SUBSCRIPTION)
@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
@Controller('/subscription-plans')
export class SubscriptionPlanController extends CrudController<SubscriptionPlan> {
	constructor(private readonly subscriptionPlanService: SubscriptionPlanService) {
		super(subscriptionPlanService);
	}

	/**
	 * Creates a plan.
	 *
	 * @param entity The plan.
	 * @returns The created plan.
	 */
	@ApiOperation({ summary: 'Create a subscription plan' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The plan was created.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The organization already has that plan code.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateSubscriptionPlanDTO): Promise<SubscriptionPlan> {
		return await this.subscriptionPlanService.create(entity as any);
	}

	/**
	 * Updates a plan.
	 *
	 * @param id The plan to update.
	 * @param entity The fields to change.
	 * @returns The updated plan.
	 */
	@ApiOperation({ summary: 'Update a subscription plan' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The plan was updated.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateSubscriptionPlanDTO): Promise<SubscriptionPlan> {
		return await this.subscriptionPlanService.updatePlan(id, entity as any);
	}

	/**
	 * Deactivates a plan.
	 *
	 * A soft delete rather than a hard one: the subscriptions that ran on this plan still point at it,
	 * and their billing history has to stay readable.
	 *
	 * @param id The plan to deactivate.
	 * @returns The deactivated plan.
	 */
	@ApiOperation({ summary: 'Deactivate a subscription plan' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The plan was deactivated.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The plan still has live subscriptions.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<SubscriptionPlan> {
		await this.subscriptionPlanService.updatePlan(id, { isActive: false } as any);

		return await this.subscriptionPlanService.softRemove(id);
	}

	/**
	 * Reads a plan.
	 *
	 * @param id The plan to read.
	 * @returns The plan.
	 */
	@ApiOperation({ summary: 'Find a subscription plan by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The plan was found.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<SubscriptionPlan> {
		return await this.subscriptionPlanService.findOneScoped(id);
	}

	/**
	 * Reads a plan by its code.
	 *
	 * @param options The `filter[code]` value.
	 * @returns The plan, or null when the organization has no such code.
	 */
	@ApiOperation({ summary: 'Find a subscription plan by code' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The plan was found, or null.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Get('code/:code')
	async findByCode(@Param('code') code: string): Promise<SubscriptionPlan | null> {
		return await this.subscriptionPlanService.findByCode(code);
	}

	/**
	 * Lists plans.
	 *
	 * @param options The filter, including `filter[isActive]` and `filter[billingPeriod]`.
	 * @returns The plans, paginated.
	 */
	@ApiOperation({ summary: 'List subscription plans' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The plans were listed.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<SubscriptionPlan>): Promise<IPagination<SubscriptionPlan>> {
		return await this.subscriptionPlanService.findAll(options);
	}
}
