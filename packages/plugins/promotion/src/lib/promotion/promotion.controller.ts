import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { Promotion } from './promotion.entity';
import { IPromotionEvaluationContext, PromotionService } from './promotion.service';
import { CreatePromotionDTO, UpdatePromotionDTO } from './dto';
import { IPromotionAction, IPromotion } from '../promotion.types';
import { PromotionPermission } from '../promotion.permissions';

/**
 * The promotion resource: the offer, its lifecycle and its dry run.
 *
 * There is one surface. A promotion is authored, activated and simulated by the same caller through
 * the same base path, and what that caller may do is decided by the permission on the route rather
 * than by a second path segment — an operator who may read an offer is not thereby allowed to start
 * it.
 *
 * Three of the routes are deliberate rather than generic. **Activation and deactivation** are their
 * own verbs because a promotion's status is not a free field: a draft that has never been reviewed
 * and an offer that was stopped are different facts, and the service is what records which one
 * happened. **`PUT :id/actions` replaces the whole action set** rather than patching it, because the
 * positions of the actions are what decide how their discounts compose. **`POST :id/simulate`** is a
 * dry run with its own grant: it computes what a basket would be given and writes nothing, so an
 * analyst may be allowed to answer "what would this cost us" without being allowed to change what it
 * costs.
 *
 * The redemption ledger is readable here and never writable: `GET :id/usage` reports the rows the
 * checkout and the cancellation operations wrote, and no route on this controller creates one.
 */
@ApiTags('Promotion')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
@Controller('/promotions')
export class PromotionController extends CrudController<Promotion> {
	constructor(private readonly promotionService: PromotionService) {
		super(promotionService);
	}

	/**
	 * Creates a promotion in draft.
	 *
	 * @param entity The offer to create.
	 * @returns The stored promotion.
	 */
	@ApiOperation({ summary: 'Create a promotion' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Promotion created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid promotion input' })
	@Permissions(PromotionPermission.PROMOTIONS_CREATE as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePromotionDTO): Promise<IPromotion> {
		return this.promotionService.createPromotion(entity as never);
	}

	/**
	 * Changes the editable fields of a promotion. The status is moved by the activation routes, so a
	 * change made here never silently starts or stops an offer.
	 *
	 * @param id The promotion to change.
	 * @param entity The fields to change.
	 * @returns The stored promotion.
	 */
	@ApiOperation({ summary: 'Update a promotion' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Promotion updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Promotion not found' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdatePromotionDTO
	): Promise<IPromotion> {
		return this.promotionService.updatePromotion(id, entity as never);
	}

	/**
	 * Deletes a promotion.
	 *
	 * @param id The promotion to delete.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a promotion' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Promotion deleted' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Promotion not found' })
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<unknown> {
		return this.promotionService.delete(id);
	}

	/**
	 * Starts a promotion: it becomes a candidate for every basket its rules match.
	 *
	 * @param id The promotion to start.
	 * @returns The started promotion.
	 */
	@ApiOperation({ summary: 'Activate a promotion' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Promotion activated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Promotion not found' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Post(':id/activate')
	@HttpCode(HttpStatus.OK)
	async activate(@Param('id', UUIDValidationPipe) id: string): Promise<IPromotion> {
		return this.promotionService.activate(id);
	}

	/**
	 * Stops a promotion. The reason is optional and is kept with the promotion, because "why was this
	 * offer pulled" is asked months later by someone who was not in the room.
	 *
	 * @param id The promotion to stop.
	 * @param body The reason the promotion is being stopped.
	 * @returns The stopped promotion.
	 */
	@ApiOperation({ summary: 'Deactivate a promotion' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Promotion deactivated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Promotion not found' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Post(':id/deactivate')
	@HttpCode(HttpStatus.OK)
	async deactivate(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { reason?: string }
	): Promise<IPromotion> {
		return this.promotionService.deactivate(id, body?.reason);
	}

	/**
	 * Replaces the whole action set of a promotion.
	 *
	 * A replacement and not a merge: an action's position is part of its meaning, so an operator who
	 * removes one action has to say where the remaining ones now sit.
	 *
	 * @param id The promotion whose actions are replaced.
	 * @param body The new action set.
	 * @returns The stored actions, in application order.
	 */
	@ApiOperation({ summary: 'Replace the action set of a promotion' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Actions replaced' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The action set is empty or invalid' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Put(':id/actions')
	async replaceActions(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { actions: Partial<IPromotionAction>[] }
	): Promise<IPromotionAction[]> {
		return this.promotionService.replaceActions(id, body?.actions);
	}

	/**
	 * Dry-runs one promotion against a basket.
	 *
	 * Nothing is written: no reservation, no budget consumption, no usage row. The answer is what the
	 * promotion would produce on its own, which is what makes it safe to hand to an analyst.
	 *
	 * @param id The promotion to simulate.
	 * @param context The basket to simulate it against.
	 * @returns The applications, notices and allocations it would produce.
	 */
	@ApiOperation({ summary: 'Simulate a promotion against a basket' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Simulation computed' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Promotion not found' })
	@Permissions(PromotionPermission.PROMOTIONS_SIMULATE as PermissionsEnum)
	@Post(':id/simulate')
	@HttpCode(HttpStatus.OK)
	async simulate(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() context: IPromotionEvaluationContext
	) {
		return this.promotionService.simulate(id, context);
	}

	/**
	 * Reads the redemption ledger of a promotion.
	 *
	 * The rows are written by the checkout and by the cancellation and return operations; this route
	 * only reports them, so an operator can reconcile a budget against what was actually given away.
	 *
	 * @param id The promotion to read.
	 * @param options Optional filters, such as a status or a window.
	 * @returns One page of redemptions.
	 */
	@ApiOperation({ summary: 'Read the usage ledger of a promotion' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Usage retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Promotion not found' })
	@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
	@Get(':id/usage')
	async findUsage(
		@Param('id', UUIDValidationPipe) id: string,
		@Query() options: Record<string, unknown>
	) {
		return this.promotionService.findUsage(id, options ?? {});
	}
}
