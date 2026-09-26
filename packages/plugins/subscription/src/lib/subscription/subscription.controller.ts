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
	Req,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ID, IPagination } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe,
	Versioned,
	versionExpectationOf
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
 *
 * Two conventions are adopted on the mutating routes and are deliberately identical on the GraphQL
 * mutations that mirror them:
 *
 * - `@Idempotent(...)` makes a route safe to retry under a client-supplied key. Billing a cycle
 *   requires one, because a lost response to it is a customer who cannot tell whether the period was
 *   charged; every other mutating route declares its own scope and honours a key when one is presented,
 *   so a client that retries is answered from the record of its first attempt rather than by performing
 *   the change twice. None of those routes demands one — a route that started demanding a key would
 *   refuse every caller it already has.
 * - `@Versioned({ resource: SubscriptionService })` refuses a write based on a subscription that has
 *   moved on and publishes the subscription's version as an `ETag`, which is the value the next write
 *   states back in `If-Match`. The write that follows is predicated on that version inside the
 *   statement that performs it, so the check the guard makes before the handler runs is not the only
 *   one.
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
	 * No version is required of the caller — there is no subscription to have read yet — and the created
	 * subscription's version is published in the response for the writes that follow it.
	 *
	 * @param entity The subscription request.
	 * @returns The created subscription.
	 */
	@ApiOperation({ summary: 'Create a subscription on a plan' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The subscription was created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The plan is not sellable or a line cannot be priced.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_CREATE)
	@Idempotent({ scope: 'subscription.create', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService, required: false })
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateSubscriptionDTO): Promise<Subscription> {
		return await this.subscriptionService.createSubscription(entity as any);
	}

	/**
	 * Updates a subscription's payer, quantity or metadata.
	 *
	 * The fields a caller may move are a closed set, so the route hands the change to the service under
	 * the version the caller read rather than patching the row itself: the statement that writes it is
	 * predicated on that version, which is what refuses a change based on a subscription another writer
	 * has already moved on.
	 *
	 * @param id The subscription to update.
	 * @param entity The fields to change.
	 * @param request The request, which carries the version the caller read the subscription at.
	 * @returns The updated subscription.
	 */
	@ApiOperation({ summary: 'Update a subscription' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The subscription was updated.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.update', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateSubscriptionDTO,
		@Req() request: Request
	): Promise<Subscription> {
		const { planId, ...changes } = entity;

		if (planId) {
			throw new BadRequestException(
				'A subscription moves to another plan through POST /subscriptions/:id/plan, which settles the remainder of the current period.'
			);
		}

		return await this.subscriptionService.applyChanges(id, changes as any, versionExpectationOf(request));
	}

	/**
	 * Deletes a subscription.
	 *
	 * The route belongs to `CrudController`, which declares `DELETE :id` with no permission metadata at
	 * all, so `PermissionGuard` (`shared/guards/permission.guard.ts`) resolves the handler first, falls
	 * back to the class and answers `true` from its `isEmpty` branch to the empty pair — leaving the route
	 * on the class-level `SUBSCRIPTIONS_VIEW` that every member of the tenant holds. This override exists
	 * only to state the permission: ending a customer's subscription is the same class of act as
	 * cancelling it, and the plugin declares no `SUBSCRIPTIONS_DELETE`, so it states `SUBSCRIPTIONS_EDIT`.
	 *
	 * @param id The subscription to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a subscription' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The subscription was deleted.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes a subscription.
	 *
	 * `DELETE :id/soft` is the second of the routes `CrudController` declares bare, and
	 * `PermissionGuard` (`shared/guards/permission.guard.ts`) answers `true` from its `isEmpty` branch
	 * whenever neither the handler nor the class declares a permission — the gap this override closes. A
	 * soft delete takes the subscription out of every read while its rows stay as history, which is the
	 * destructive half of that pair, so it states the same `SUBSCRIPTIONS_EDIT` its `delete` sibling does.
	 *
	 * @param id The subscription to soft delete.
	 * @returns The soft-deleted subscription.
	 */
	@ApiOperation({ summary: 'Soft delete a subscription' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The subscription was soft deleted.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted subscription.
	 *
	 * `PUT :id/recover` is the third inherited route `CrudController` declares with no permission metadata,
	 * so `PermissionGuard` (`shared/guards/permission.guard.ts`) returned `true` from its `isEmpty` branch
	 * and nothing but the class-level `SUBSCRIPTIONS_VIEW` stood in front of it. This override exists only
	 * to state the permission a restore has to carry: it undoes the delete above, so it takes the same
	 * `SUBSCRIPTIONS_EDIT` grant that delete and soft delete take.
	 *
	 * @param id The subscription to restore.
	 * @returns The restored subscription.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted subscription' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The subscription was restored.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}

	/**
	 * Activates a pending subscription.
	 *
	 * @param id The subscription to activate.
	 * @param request The request, which carries the version the caller read the subscription at.
	 * @returns The activated subscription.
	 */
	@ApiOperation({ summary: 'Activate a pending subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subscription is active.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.activate', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Post(':id/activate')
	async activate(@Param('id', UUIDValidationPipe) id: ID, @Req() request: Request): Promise<Subscription> {
		return await this.subscriptionService.activate(id, versionExpectationOf(request));
	}

	/**
	 * Pauses a subscription.
	 *
	 * @param id The subscription to pause.
	 * @param entity Until when, and why.
	 * @param request The request, which carries the version the caller read the subscription at.
	 * @returns The paused subscription.
	 */
	@ApiOperation({ summary: 'Pause a subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subscription is paused.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.pause', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Post(':id/pause')
	@UseValidationPipe({ transform: true, whitelist: true })
	async pause(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: PauseSubscriptionDTO,
		@Req() request: Request
	): Promise<Subscription> {
		return await this.subscriptionService.pause(
			id,
			{ until: entity.until, reason: entity.reason },
			versionExpectationOf(request)
		);
	}

	/**
	 * Resumes a paused subscription.
	 *
	 * @param id The subscription to resume.
	 * @param request The request, which carries the version the caller read the subscription at.
	 * @returns The resumed subscription.
	 */
	@ApiOperation({ summary: 'Resume a paused subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subscription is billing again.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.resume', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Post(':id/resume')
	async resume(@Param('id', UUIDValidationPipe) id: ID, @Req() request: Request): Promise<Subscription> {
		return await this.subscriptionService.resume(id, undefined, versionExpectationOf(request));
	}

	/**
	 * Cancels a subscription.
	 *
	 * @param id The subscription to cancel.
	 * @param entity Why, and whether it ends now.
	 * @param request The request, which carries the version the caller read the subscription at.
	 * @returns The cancelled subscription.
	 */
	@ApiOperation({ summary: 'Cancel a subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subscription is cancelled.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.cancel', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Post(':id/cancel')
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: CancelSubscriptionDTO,
		@Req() request: Request
	): Promise<Subscription> {
		return await this.subscriptionService.cancel(
			id,
			{ reason: entity.reason, immediate: entity.immediate },
			versionExpectationOf(request)
		);
	}

	/**
	 * Expires a subscription.
	 *
	 * @param id The subscription to expire.
	 * @param entity Why.
	 * @param request The request, which carries the version the caller read the subscription at.
	 * @returns The expired subscription.
	 */
	@ApiOperation({ summary: 'Expire a subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The subscription is expired.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.expire', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Post(':id/expire')
	@UseValidationPipe({ transform: true, whitelist: true })
	async expire(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ExpireSubscriptionDTO,
		@Req() request: Request
	): Promise<Subscription> {
		return await this.subscriptionService.expire(id, entity.reason, versionExpectationOf(request));
	}

	/**
	 * Moves a subscription to another plan, settling the remainder of the current period.
	 *
	 * A plan change charges the prorated difference through the ordinary order path, which is the
	 * strongest case in this plugin for a retry key: a client that loses the response cannot tell whether
	 * the difference was collected, and a second attempt under the same key is answered from the record
	 * of the first rather than charging the customer twice for the same remainder of the period.
	 *
	 * @param id The subscription to change.
	 * @param entity The plan, the quantity and when the change takes effect.
	 * @param request The request, which carries the version the caller read the subscription at.
	 * @returns What the change decided and what it settled.
	 */
	@ApiOperation({ summary: 'Change the plan of a subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The plan change was applied.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.plan.change', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Post(':id/plan')
	@UseValidationPipe({ transform: true, whitelist: true })
	async changePlan(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ChangeSubscriptionPlanDTO,
		@Req() request: Request
	): Promise<ISubscriptionPlanChangeOutcome> {
		return await this.subscriptionService.changePlan(id, entity as any, versionExpectationOf(request));
	}

	/**
	 * Adds a recurring line mid-cycle.
	 *
	 * Adding a line charges the prorated difference for the remainder of the period through the ordinary
	 * order path, so this route is the other strong case for a retry key: a lost response to it is a
	 * client that cannot tell whether the line it asked for was added and charged, and a retry under the
	 * same key is answered from the record of the first attempt.
	 *
	 * @param id The subscription.
	 * @param entity The line to add.
	 * @param request The request, which carries the version the caller read the subscription at.
	 * @returns What the change decided and what it settled.
	 */
	@ApiOperation({ summary: 'Add a recurring line to a subscription' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The line was added.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.item.add', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@HttpCode(HttpStatus.CREATED)
	@Post(':id/items')
	@UseValidationPipe({ transform: true, whitelist: true })
	async addItem(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: SubscriptionItemInputDTO,
		@Req() request: Request
	): Promise<ISubscriptionPlanChangeOutcome> {
		return await this.subscriptionService.addItem(id, entity as any, versionExpectationOf(request));
	}

	/**
	 * Changes a recurring line's quantity mid-cycle.
	 *
	 * @param id The subscription.
	 * @param variantId The variant whose line is changing.
	 * @param entity The new quantity.
	 * @param request The request, which carries the version the caller read the subscription at.
	 * @returns What the change decided and what it settled.
	 */
	@ApiOperation({ summary: 'Change the quantity of a recurring line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The quantity was changed.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.item.change_quantity', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Put(':id/items/:variantId')
	@UseValidationPipe({ transform: true, whitelist: true })
	async changeItemQuantity(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('variantId', UUIDValidationPipe) variantId: ID,
		@Body() entity: SubscriptionItemInputDTO,
		@Req() request: Request
	): Promise<ISubscriptionPlanChangeOutcome> {
		return await this.subscriptionService.changeItemQuantity(
			id,
			variantId,
			entity.quantity ?? '1',
			versionExpectationOf(request)
		);
	}

	/**
	 * Removes a recurring line mid-cycle.
	 *
	 * The route names the subscription whose line is going, but it removes a child row rather than
	 * writing the subscription, so it states no version and the write it does make to the subscription —
	 * the proration it records in the metadata — is predicated on the version the row holds.
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
	 * A retry presents the same key and is answered from the record of the first attempt, so a lost
	 * response never bills a period twice, and the caller states the version it read so a cycle is not
	 * run against a subscription that has moved on since.
	 *
	 * @param id The subscription to bill.
	 * @param entity The instant to bill against.
	 * @param request The request, which carries the version the caller read the subscription at.
	 * @returns What the cycle did.
	 */
	@ApiOperation({ summary: 'Bill one cycle of a subscription' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The cycle was billed or is already settled.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Idempotent({ scope: 'subscription.bill', required: true, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Post(':id/bill')
	@UseValidationPipe({ transform: true, whitelist: true })
	async bill(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: BillSubscriptionDTO,
		@Req() request: Request
	): Promise<ISubscriptionBillingOutcome> {
		return await this.subscriptionService.billCycle(
			id,
			{ asOf: entity.asOf, manual: true },
			versionExpectationOf(request)
		);
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
