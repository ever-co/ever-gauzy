import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { PromotionUsage } from './promotion-usage.entity';
import { PromotionUsageService } from './promotion-usage.service';
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
 * This controller adds no route and no mutation of its own. The ledger is read here so that the
 * discount on an order can be explained, and it is written by the operations that own it: the
 * checkout reserves a row while the basket is being paid for and registers it when the order is
 * placed, and the cancellation and return flows move it to `REVERTED` through the same service. The
 * class-level `PROMOTIONS_VIEW` grant is what guards the routes the base controller contributes.
 */
@ApiTags('PromotionUsage')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
@Controller('/promotion-usages')
export class PromotionUsageController extends CrudController<PromotionUsage> {
	constructor(private readonly promotionUsageService: PromotionUsageService) {
		super(promotionUsageService);
	}
}
