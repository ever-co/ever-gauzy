import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { CampaignBudget } from './campaign-budget.entity';
import { CampaignBudgetService } from './campaign-budget.service';
import { CreateCampaignBudgetDTO, UpdateCampaignBudgetDTO } from './dto';
import { PromotionPermission } from '../promotion.permissions';

/**
 * The campaign-budget resource.
 *
 * A budget is reachable on its own path as well as through its campaign, because the two callers are
 * different: an operator maintaining one campaign sets it through `PUT /campaigns/:id/budget`, while
 * a reconciliation reads the ceilings directly here, one page at a time.
 *
 * The consumption column is **not** writable. `used` is a cache of the usage ledger — the checkout
 * consumes it through a single conditional statement and the reversion gives it back — so a hand
 * written value would be silently overwritten by the next reconciliation. Re-opening a budget is the
 * campaign's reset route, which is the one operation that means "forget what was spent".
 */
@ApiTags('CampaignBudget')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
@Controller('/campaign-budgets')
export class CampaignBudgetController extends CrudController<CampaignBudget> {
	constructor(private readonly campaignBudgetService: CampaignBudgetService) {
		super(campaignBudgetService);
	}

	/**
	 * Creates the budget of a campaign.
	 *
	 * @param entity The ceiling to store.
	 * @returns The stored budget.
	 */
	@ApiOperation({ summary: 'Create a campaign budget' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Budget created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The shape does not match the budget type' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCampaignBudgetDTO): Promise<CampaignBudget> {
		return this.campaignBudgetService.create(entity as never);
	}

	/**
	 * Changes a budget's ceiling or currency. The consumption already recorded is left alone.
	 *
	 * @param id The budget to change.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a campaign budget' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Budget updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Budget not found' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateCampaignBudgetDTO) {
		return this.campaignBudgetService.update(id, entity as never);
	}

	/**
	 * Deletes a budget. A campaign left without one is unbounded, which is a deliberate state.
	 *
	 * @param id The budget to delete.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a campaign budget' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Budget deleted' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Budget not found' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<unknown> {
		return super.delete(id);
	}

	/**
	 * Soft deletes a campaign budget.
	 *
	 * The route belongs to `CrudController`, which declares it with no `@Permissions` metadata at
	 * all, so `PermissionGuard` answers `true` to that empty metadata (`permission.guard.ts`, the
	 * `isEmpty` return) and only the class-level view grant was left in front of it. The override
	 * exists only to state the destructive grant the route needs, `PROMOTIONS_DELETE`: a budget is a
	 * child of one campaign, and a campaign left without a ceiling is a deliberate state the
	 * campaign's own delete grant governs.
	 *
	 * @param id The budget to soft delete.
	 * @returns The soft-deleted budget.
	 */
	@ApiOperation({ summary: 'Soft delete a campaign budget' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Budget soft deleted' })
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted campaign budget.
	 *
	 * The route belongs to `CrudController`, which declares it with no `@Permissions` metadata at
	 * all, so `PermissionGuard` answers `true` to that empty metadata (`permission.guard.ts`, the
	 * `isEmpty` return) and only the class-level view grant was left in front of it. The override
	 * exists only to state the destructive grant the route needs, `PROMOTIONS_DELETE`, because
	 * restoring a ceiling re-opens spending that the campaign's own delete grant governs.
	 *
	 * @param id The budget to restore.
	 * @returns The restored budget.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted campaign budget' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Budget restored' })
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
