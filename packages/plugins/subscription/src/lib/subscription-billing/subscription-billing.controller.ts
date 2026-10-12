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
import {
	CreateSubscriptionBillingDTO,
	PaySubscriptionBillingDTO,
	UpdateSubscriptionBillingDTO,
	WaiveSubscriptionBillingDTO
} from './dto';
import { SubscriptionBilling } from './subscription-billing.entity';
import { SubscriptionBillingService } from './subscription-billing.service';

/**
 * Billing cycles.
 *
 * The history is readable under `SUBSCRIPTIONS_VIEW` and every write is under `SUBSCRIPTIONS_BILL`,
 * because the writes are the ones that move money or decide not to: `pay` records that a cycle's
 * money arrived, `waive` records that it deliberately will not, and `refund` gives a settled cycle
 * back. A cycle's attempt history is written by the billing run and is not editable here.
 */
@ApiTags('SubscriptionBilling')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(SubscriptionFeatures.SUBSCRIPTION)
@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
@Controller('/subscription-billings')
export class SubscriptionBillingController extends CrudController<SubscriptionBilling> {
	constructor(private readonly subscriptionBillingService: SubscriptionBillingService) {
		super(subscriptionBillingService);
	}

	/**
	 * Opens a billing cycle by hand.
	 *
	 * The billing run writes its own rows; this exists for a backfill, and the unique
	 * `(subscriptionId, periodStart)` key means a hand-written row and a scheduled one cannot both
	 * exist for the same period.
	 *
	 * @param entity The cycle.
	 * @returns The created cycle.
	 */
	@ApiOperation({ summary: 'Open a billing cycle by hand' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The cycle was opened.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateSubscriptionBillingDTO): Promise<SubscriptionBilling> {
		return await this.subscriptionBillingService.createPending(entity as any);
	}

	/**
	 * Corrects a cycle that has not been charged.
	 *
	 * @param id The cycle to update.
	 * @param entity The fields to change.
	 * @returns The updated cycle.
	 */
	@ApiOperation({ summary: 'Correct a billing cycle' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cycle was updated.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateSubscriptionBillingDTO
	): Promise<SubscriptionBilling> {
		await this.subscriptionBillingService.update(id, entity as any);

		return await this.subscriptionBillingService.findOneScoped(id);
	}

	/**
	 * Deletes a billing cycle.
	 *
	 * The route belongs to `CrudController`, which declares `DELETE :id` with no permission metadata at
	 * all: `PermissionGuard` (`shared/guards/permission.guard.ts`) reads the handler first, then the class,
	 * and answers `true` from its `isEmpty` branch when the pair is empty, so only the read grant
	 * `SUBSCRIPTIONS_VIEW` stood in front of it. This override exists only to state the permission such a
	 * delete has to carry — a cycle is the record of money billed, and the plugin declares no
	 * `SUBSCRIPTIONS_DELETE`, so the child row takes the subscription's destructive grant,
	 * `SUBSCRIPTIONS_EDIT`.
	 *
	 * @param id The cycle to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a billing cycle' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cycle was deleted.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes a billing cycle.
	 *
	 * `DELETE :id/soft` is declared by `CrudController` with no permission metadata either, so
	 * `PermissionGuard` (`shared/guards/permission.guard.ts`) answers `true` from its `isEmpty` branch and
	 * the inherited route is reachable by any tenant member — the same omission this override repairs. A
	 * soft-deleted cycle leaves every billing read while its row survives as history, so it states the
	 * grant its `delete` sibling states: `SUBSCRIPTIONS_EDIT`.
	 *
	 * @param id The cycle to soft delete.
	 * @returns The soft-deleted cycle.
	 */
	@ApiOperation({ summary: 'Soft delete a billing cycle' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cycle was soft deleted.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted billing cycle.
	 *
	 * The third bare route `CrudController` declares is `PUT :id/recover`, and
	 * `PermissionGuard` (`shared/guards/permission.guard.ts`) returning `true` from its `isEmpty` branch is
	 * what left it on the class-level `SUBSCRIPTIONS_VIEW` alone. This override exists only to state the
	 * permission: putting a cycle back into the billing history is the inverse of deleting it, so it takes
	 * the same `SUBSCRIPTIONS_EDIT` grant.
	 *
	 * @param id The cycle to restore.
	 * @returns The restored cycle.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted billing cycle' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cycle was restored.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}

	/**
	 * Records that a cycle's money arrived.
	 *
	 * @param id The cycle.
	 * @param entity When it settled, and a note.
	 * @returns The updated cycle.
	 */
	@ApiOperation({ summary: 'Record the payment of a billing cycle' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The cycle is paid.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Post(':id/pay')
	@UseValidationPipe({ transform: true, whitelist: true })
	async pay(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: PaySubscriptionBillingDTO): Promise<SubscriptionBilling> {
		return await this.subscriptionBillingService.markPaid(id, { paidAt: entity.paidAt });
	}

	/**
	 * Records that a cycle was deliberately not charged.
	 *
	 * @param id The cycle.
	 * @param entity Why it was waived.
	 * @returns The updated cycle.
	 */
	@ApiOperation({ summary: 'Waive a billing cycle' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The cycle is waived.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Post(':id/waive')
	@UseValidationPipe({ transform: true, whitelist: true })
	async waive(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: WaiveSubscriptionBillingDTO
	): Promise<SubscriptionBilling> {
		return await this.subscriptionBillingService.markWaived(id, { reason: entity.reason });
	}

	/**
	 * Records that a paid cycle was refunded.
	 *
	 * @param id The cycle.
	 * @returns The updated cycle.
	 */
	@ApiOperation({ summary: 'Refund a paid billing cycle' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The cycle is refunded.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Post(':id/refund')
	async refund(@Param('id', UUIDValidationPipe) id: ID): Promise<SubscriptionBilling> {
		return await this.subscriptionBillingService.markRefunded(id);
	}

	/**
	 * Reads a billing cycle.
	 *
	 * @param id The cycle to read.
	 * @returns The cycle.
	 */
	@ApiOperation({ summary: 'Find a billing cycle by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The cycle was found.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<SubscriptionBilling> {
		return await this.subscriptionBillingService.findOneScoped(id);
	}

	/**
	 * Lists billing cycles.
	 *
	 * @param options The filter, including `filter[status]`, `filter[subscriptionId]` and
	 * `filter[orderId]`.
	 * @returns The cycles, paginated.
	 */
	@ApiOperation({ summary: 'List billing cycles' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The cycles were listed.' })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<SubscriptionBilling>): Promise<IPagination<SubscriptionBilling>> {
		return await this.subscriptionBillingService.findAll(options);
	}
}
