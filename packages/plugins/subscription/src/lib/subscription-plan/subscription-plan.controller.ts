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
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
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
	 * Soft deletes a plan.
	 *
	 * The route belongs to `CrudController`, which declares `DELETE :id/soft` with no permission metadata
	 * at all, so `PermissionGuard` (`shared/guards/permission.guard.ts`) answers `true` from its `isEmpty`
	 * branch to the empty pair and the inherited route was left on the class-level `SUBSCRIPTIONS_VIEW`.
	 * Deactivation is this plugin's delete — the row stays for the subscriptions that point at it — so the
	 * override states `SUBSCRIPTIONS_EDIT`, the grant the `delete` above and the plugin's own
	 * `deleteSubscriptionPlan` mutation state for the same act.
	 *
	 * @param id The plan to deactivate.
	 * @returns The soft-deleted plan.
	 */
	@ApiOperation({ summary: 'Soft delete a subscription plan' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The plan was soft deleted.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted plan.
	 *
	 * `PUT :id/recover` is the last of the five mutating routes `CrudController` declares, and like the
	 * others it carries no permission metadata, so `PermissionGuard`
	 * (`shared/guards/permission.guard.ts`) answered `true` from its `isEmpty` branch before the
	 * class-level `SUBSCRIPTIONS_VIEW` was consulted. This override exists only to state the permission:
	 * putting a plan back on offer reverses the soft delete above, so it states the same
	 * `SUBSCRIPTIONS_EDIT` grant.
	 *
	 * @param id The plan to restore.
	 * @returns The restored plan.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted subscription plan' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The plan was restored.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
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
