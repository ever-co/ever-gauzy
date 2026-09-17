import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
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
import { PromotionAction } from './promotion-action.entity';
import { PromotionActionService } from './promotion-action.service';
import { CreatePromotionActionDTO, UpdatePromotionActionDTO } from './dto';
import { PromotionPermission } from '../promotion.permissions';

/**
 * The promotion-action resource: what an offer does when it matches.
 *
 * An action is normally authored as part of its promotion — `PUT /promotions/:id/actions` replaces
 * the whole set at once, because the positions of the actions are what decide how their discounts
 * compose. This path is the one-row view of the same table: it is what an operator reads to explain
 * a single line of an offer, and what a repair edits when one action's value has to be corrected
 * without restating the set.
 *
 * Changing an action's type, target or allocation is how an offer is reshaped; the service refuses a
 * combination the promotion's own type does not allow, so a `BUY_GET` promotion cannot be given a
 * percentage that its buy rules could never drive.
 */
@ApiTags('PromotionAction')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
@Controller('/promotion-actions')
export class PromotionActionController extends CrudController<PromotionAction> {
	constructor(private readonly promotionActionService: PromotionActionService) {
		super(promotionActionService);
	}

	/**
	 * Creates one action on a promotion.
	 *
	 * @param entity The action to create.
	 * @returns The stored action.
	 */
	@ApiOperation({ summary: 'Create a promotion action' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Action created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The action is invalid for its promotion type' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePromotionActionDTO): Promise<PromotionAction> {
		return this.promotionActionService.create(entity as never);
	}

	/**
	 * Changes one action.
	 *
	 * @param id The action to change.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a promotion action' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Action updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Action not found' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdatePromotionActionDTO) {
		return this.promotionActionService.update(id, entity as never);
	}

	/**
	 * Deletes one action, leaving the others in their positions.
	 *
	 * @param id The action to delete.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a promotion action' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Action deleted' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Action not found' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<unknown> {
		return this.promotionActionService.delete(id);
	}
}
