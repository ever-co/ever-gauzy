import { Body, Controller, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
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
import { PromotionUsage } from './promotion-usage.entity';
import { PromotionUsageService } from './promotion-usage.service';
import { CreatePromotionUsageDTO, UpdatePromotionUsageDTO } from './dto';
import { PromotionPermission } from '../promotion.permissions';

/**
 * The promotion-usage resource: one row per application of a promotion.
 *
 * A row is a fact about a redemption, not a record an operator maintains. It is written by the
 * checkout — reserved while the basket is being paid for, then registered when the order is placed —
 * and it is the row the limits and the budget are checked against: the global and per-customer caps
 * are counted here, and the ledger is what a budget's consumption is reconciled from. A cancellation
 * or a return moves the row to `REVERTED` through the same service, which is what gives the discount
 * back to the ceiling it came from.
 *
 * This controller adds no rule of its own beyond that: the ledger is read here so that the discount on
 * an order can be explained, and it is written by the operations that own it — the checkout reserves a
 * row while the basket is being paid for and registers it when the order is placed, and the
 * cancellation and return flows move it to `REVERTED` through the same service. The two write routes
 * below are declared rather than inherited because a body is validated from the type the handler
 * names, and the base class names the entity's shape as a generic — a parameter the validation pipe
 * cannot name a class for is not validated at all, so an inherited route accepts any body and writes
 * it. They are the repair surface an operator correcting a drifted row uses, and they carry the edit
 * grant rather than the read one, because a row written here is counted against the caps and the
 * budget the next basket is checked against. The class-level `PROMOTIONS_VIEW` grant is what guards
 * the read routes the base controller contributes.
 */
@ApiTags('PromotionUsage')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
@Controller('/promotion-usages')
export class PromotionUsageController extends CrudController<PromotionUsage> {
	constructor(private readonly promotionUsageService: PromotionUsageService) {
		super(promotionUsageService);
	}

	/**
	 * Records one application of a promotion.
	 *
	 * @param entity The usage row to record.
	 * @returns The stored row.
	 */
	@ApiOperation({ summary: 'Record a promotion usage row' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Usage row recorded' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid usage input' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePromotionUsageDTO): Promise<PromotionUsage> {
		return this.promotionUsageService.create(entity as never);
	}

	/**
	 * Changes a usage row, which is how a reservation is registered or reverted by hand.
	 *
	 * @param id The row to change.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a promotion usage row' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Usage row updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Usage row not found' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdatePromotionUsageDTO) {
		return this.promotionUsageService.update(id, entity as never);
	}
}
