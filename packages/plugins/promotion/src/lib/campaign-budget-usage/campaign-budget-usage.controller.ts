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
import { CampaignBudgetUsage } from './campaign-budget-usage.entity';
import { CampaignBudgetUsageService } from './campaign-budget-usage.service';
import { CreateCampaignBudgetUsageDTO, UpdateCampaignBudgetUsageDTO } from './dto';
import { PromotionPermission } from '../promotion.permissions';

/**
 * The campaign-budget-usage resource: what a budget split by attribute has spent per value.
 *
 * One row per value of the budget's attribute, so a ceiling that is shared across, say, customer
 * groups can be exhausted for one group without closing the others. The row is the gate: a
 * consumption against a value is admitted by a conditional statement on this row and the parent
 * budget is advanced by the same amount in the same transaction, which is what stops the two from
 * disagreeing after a commit.
 *
 * The rows are written by the checkout while it is consuming budget, and this controller is how an
 * operator sees which value is running out. The write routes below are a repair surface — the
 * reconciliation job and an operator correcting a drifted row use them — and they are granted the
 * promotion *edit* permission rather than the read one, because a figure written here changes what
 * the next reservation against that value is allowed to take.
 */
@ApiTags('CampaignBudgetUsage')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
@Controller('/campaign-budget-usages')
export class CampaignBudgetUsageController extends CrudController<CampaignBudgetUsage> {
	constructor(private readonly campaignBudgetUsageService: CampaignBudgetUsageService) {
		super(campaignBudgetUsageService);
	}

	/**
	 * Creates the per-value row of a budget.
	 *
	 * @param entity The row to create.
	 * @returns The stored row.
	 */
	@ApiOperation({ summary: 'Create a campaign budget usage row' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Usage row created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid usage input' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCampaignBudgetUsageDTO): Promise<CampaignBudgetUsage> {
		return this.campaignBudgetUsageService.create(entity as never);
	}

	/**
	 * Changes a per-value row.
	 *
	 * @param id The row to change.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a campaign budget usage row' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Usage row updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Usage row not found' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateCampaignBudgetUsageDTO) {
		return this.campaignBudgetUsageService.update(id, entity as never);
	}

	/**
	 * Deletes a per-value row.
	 *
	 * @param id The row to delete.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a campaign budget usage row' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Usage row deleted' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Usage row not found' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<unknown> {
		return super.delete(id);
	}

	/**
	 * Soft deletes a per-value consumption row of a campaign budget.
	 *
	 * The route belongs to `CrudController`, which declares it with no `@Permissions` metadata at
	 * all, so `PermissionGuard` answers `true` to that empty metadata (`permission.guard.ts`, the
	 * `isEmpty` return) and only the class-level view grant was left in front of it. The override
	 * exists only to state the destructive grant the route needs, `PROMOTIONS_DELETE`: the row is a
	 * child of one budget and of the campaign above it, so the campaign's delete grant governs it.
	 *
	 * @param id The usage row to soft delete.
	 * @returns The soft-deleted usage row.
	 */
	@ApiOperation({ summary: 'Soft delete a campaign budget usage row' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Usage row soft deleted' })
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted per-value consumption row of a campaign budget.
	 *
	 * The route belongs to `CrudController`, which declares it with no `@Permissions` metadata at
	 * all, so `PermissionGuard` answers `true` to that empty metadata (`permission.guard.ts`, the
	 * `isEmpty` return) and only the class-level view grant was left in front of it. The override
	 * exists only to state the destructive grant the route needs, `PROMOTIONS_DELETE`, because the
	 * restored figure is what the next reservation against that value is allowed to take.
	 *
	 * @param id The usage row to restore.
	 * @returns The restored usage row.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted campaign budget usage row' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Usage row restored' })
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
