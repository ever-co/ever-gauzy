import {
	BadRequestException,
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
	UseGuards
} from '@nestjs/common';
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
import {
	BillSubscriptionDTO,
	CancelSubscriptionDTO,
	ChangeSubscriptionPlanDTO,
	CreateSubscriptionDTO,
	ExpireSubscriptionDTO,
	PauseSubscriptionDTO,
	RunSubscriptionBillingDTO,
	SubscriptionItemInputDTO,
	UpdateSubscriptionDTO
} from './dto';
import { SubscriptionBilling } from '../subscription-billing/subscription-billing.entity';
import {
	ISubscriptionBillingOutcome,
	ISubscriptionBillingRunOutcome,
	ISubscriptionPlanChangeOutcome
} from '../subscription.types';
import { Subscription } from './subscription.entity';
import { SubscriptionService } from './subscription.service';

/**
 * Subscriptions.
 *
 * The CRUD surface is inherited and the lifecycle is declared, because a subscription is not edited
 * into its next state — it is activated, paused, resumed, cancelled or expired, and each of those is
 * an action with a consequence outside this table. `SUBSCRIPTIONS_EDIT` covers the lifecycle and
 * `SUBSCRIPTIONS_BILL` covers billing, so a support role can stop a subscription without being able
 * to charge one.
 *
 * The prorated changes live here rather than on the item controller because a proration is a fact
 * about the subscription's period: adding a line has a price consequence the subscription's calendar
 * decides, and a caller that had to reconstruct that would one day reconstruct it differently.
 */
@ApiTags('Subscription')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(SubscriptionFeatures.SUBSCRIPTION)
@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
@Controller('/subscriptions')
export class SubscriptionController extends CrudController<Subscription> {
	constructor(private readonly subscriptionService: SubscriptionService) {
		super(subscriptionService);
	}

	/**
	 * Starts a subscription on a plan.
	 *
	 * @param entity The subscription request.
	 * @returns The created subscription.
	 */
	@ApiOperation({ summary: 'Create a subscription on a plan' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The subscription was created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The plan is not sellable or a line cannot be priced.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateSubscriptionDTO): Promise<Subscription> {
		return await this.subscriptionService.createSubscription(entity as any);
	}

	/**
	 * Updates a subscription's payer, quantity or metadata.
	 *
	 * @param id The subscription to update.
	 * @param entity The fields to change.
	 * @returns The updated subscription.
	 */
	@ApiOperation({ summary: 'Update a subscription' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The subscription was updated.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateSubscriptionDTO): Promise<Subscription> {
		const { planId, ...changes } = entity;

		if (planId) {
			throw new BadRequestException(
				'A subscription moves to another plan through POST /subscriptions/:id/plan, which settles the remainder of the current period.'
			);
		}

		await this.subscriptionService.update(id, changes as any);

		return await this.subscriptionService.findOneDetailed(id);
	}

	/**
	 * Activates a pending subscription.
	 *
	 * @param id The subscription to activate.
	 * @returns The activated subscription.
	 */
	@ApiOperation({ summary: 'Activate a pending subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subscription is active.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Post(':id/activate')
	async activate(@Param('id', UUIDValidationPipe) id: ID): Promise<Subscription> {
		return await this.subscriptionService.activate(id);
	}

	/**
	 * Pauses a subscription.
	 *
	 * @param id The subscription to pause.
	 * @param entity Until when, and why.
	 * @returns The paused subscription.
	 */
	@ApiOperation({ summary: 'Pause a subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subscription is paused.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Post(':id/pause')
	@UseValidationPipe({ transform: true, whitelist: true })
	async pause(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: PauseSubscriptionDTO): Promise<Subscription> {
		return await this.subscriptionService.pause(id, { until: entity.until, reason: entity.reason });
	}

	/**
	 * Resumes a paused subscription.
	 *
	 * @param id The subscription to resume.
	 * @returns The resumed subscription.
	 */
	@ApiOperation({ summary: 'Resume a paused subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subscription is billing again.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Post(':id/resume')
	async resume(@Param('id', UUIDValidationPipe) id: ID): Promise<Subscription> {
		return await this.subscriptionService.resume(id);
	}

	/**
	 * Cancels a subscription.
	 *
	 * @param id The subscription to cancel.
	 * @param entity Why, and whether it ends now.
	 * @returns The cancelled subscription.
	 */
	@ApiOperation({ summary: 'Cancel a subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subscription is cancelled.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Post(':id/cancel')
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: CancelSubscriptionDTO): Promise<Subscription> {
		return await this.subscriptionService.cancel(id, { reason: entity.reason, immediate: entity.immediate });
	}

	/**
	 * Expires a subscription.
	 *
	 * @param id The subscription to expire.
	 * @param entity Why.
	 * @returns The expired subscription.
	 */
	@ApiOperation({ summary: 'Expire a subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subscription is expired.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Post(':id/expire')
	@UseValidationPipe({ transform: true, whitelist: true })
	async expire(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: ExpireSubscriptionDTO): Promise<Subscription> {
		return await this.subscriptionService.expire(id, entity.reason);
	}

	/**
	 * Moves a subscription to another plan, settling the remainder of the current period.
	 *
	 * @param id The subscription to change.
	 * @param entity The plan, the quantity and when the change takes effect.
	 * @returns What the change decided and what it settled.
	 */
	@ApiOperation({ summary: 'Change the plan of a subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The plan change was applied.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Post(':id/plan')
	@UseValidationPipe({ transform: true, whitelist: true })
	async changePlan(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ChangeSubscriptionPlanDTO
	): Promise<ISubscriptionPlanChangeOutcome> {
		return await this.subscriptionService.changePlan(id, entity as any);
	}

	/**
	 * Adds a recurring line mid-cycle.
	 *
	 * @param id The subscription.
	 * @param entity The line to add.
	 * @returns What the change decided and what it settled.
	 */
	@ApiOperation({ summary: 'Add a recurring line to a subscription' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The line was added.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post(':id/items')
	@UseValidationPipe({ transform: true, whitelist: true })
	async addItem(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: SubscriptionItemInputDTO
	): Promise<ISubscriptionPlanChangeOutcome> {
		return await this.subscriptionService.addItem(id, entity as any);
	}

	/**
	 * Changes a recurring line's quantity mid-cycle.
	 *
	 * @param id The subscription.
	 * @param variantId The variant whose line is changing.
	 * @param entity The new quantity.
	 * @returns What the change decided and what it settled.
	 */
	@ApiOperation({ summary: 'Change the quantity of a recurring line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The quantity was changed.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Put(':id/items/:variantId')
	@UseValidationPipe({ transform: true, whitelist: true })
	async changeItemQuantity(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('variantId', UUIDValidationPipe) variantId: ID,
		@Body() entity: SubscriptionItemInputDTO
	): Promise<ISubscriptionPlanChangeOutcome> {
		return await this.subscriptionService.changeItemQuantity(id, variantId, entity.quantity ?? '1');
	}

	/**
	 * Removes a recurring line mid-cycle.
	 *
	 * @param id The subscription.
	 * @param variantId The variant whose line is being removed.
	 * @returns What the change decided and what it settled.
	 */
	@ApiOperation({ summary: 'Remove a recurring line from a subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The line was removed.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Delete(':id/items/:variantId')
	async removeItem(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('variantId', UUIDValidationPipe) variantId: ID
	): Promise<ISubscriptionPlanChangeOutcome> {
		return await this.subscriptionService.removeItem(id, variantId);
	}

	/**
	 * Bills one cycle of one subscription.
	 *
	 * @param id The subscription to bill.
	 * @param entity The instant to bill against.
	 * @returns What the cycle did.
	 */
	@ApiOperation({ summary: 'Bill one cycle of a subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The cycle was billed or is already settled.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Post(':id/bill')
	@UseValidationPipe({ transform: true, whitelist: true })
	async bill(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: BillSubscriptionDTO): Promise<ISubscriptionBillingOutcome> {
		return await this.subscriptionService.billCycle(id, { asOf: entity.asOf, manual: true });
	}

	/**
	 * Runs a billing pass.
	 *
	 * @param entity The instant to run against, how many subscriptions one pass may take, and an
	 * optional single subscription to restrict it to.
	 * @returns What the pass did.
	 */
	@ApiOperation({ summary: 'Run the subscription billing pass' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The pass ran.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Post('billing-run')
	@UseValidationPipe({ transform: true, whitelist: true })
	async billingRun(@Body() entity: RunSubscriptionBillingDTO): Promise<ISubscriptionBillingRunOutcome> {
		return await this.subscriptionService.runBilling({
			asOf: entity.asOf,
			limit: entity.limit,
			subscriptionId: entity.subscriptionId
		});
	}

	/**
	 * Reads a subscription's billing history.
	 *
	 * @param id The subscription.
	 * @returns Its cycles, newest period first.
	 */
	@ApiOperation({ summary: 'List the billing history of a subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The history was listed.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Get(':id/billings')
	async billings(@Param('id', UUIDValidationPipe) id: ID): Promise<SubscriptionBilling[]> {
		return await this.subscriptionService.findBillings(id);
	}

	/**
	 * Reads a subscription with its lines and its billing history.
	 *
	 * @param id The subscription to read.
	 * @returns The subscription.
	 */
	@ApiOperation({ summary: 'Find a subscription with its lines and its history' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subscription was found.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<Subscription> {
		return await this.subscriptionService.findOneDetailed(id);
	}

	/**
	 * Lists subscriptions.
	 *
	 * @param options The filter, including `filter[status]`, `filter[planId]` and `filter[customerId]`.
	 * @returns The subscriptions, paginated.
	 */
	@ApiOperation({ summary: 'List subscriptions' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subscriptions were listed.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<Subscription>): Promise<IPagination<Subscription>> {
		return await this.subscriptionService.findAll(options);
	}
}
