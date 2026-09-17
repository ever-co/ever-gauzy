import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import {
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { Campaign } from './campaign.entity';
import { CampaignService } from './campaign.service';
import { CampaignBudgetService } from '../campaign-budget/campaign-budget.service';
import { CreateCampaignDTO, UpdateCampaignDTO } from './dto';
import { CreateCampaignBudgetDTO } from '../campaign-budget/dto';
import { ICampaign, ICampaignBudget, ICampaignBudgetUsage } from '../promotion.types';
import { PromotionPermission } from '../promotion.permissions';

/**
 * The campaign resource: the window and the ceiling a group of promotions runs inside.
 *
 * A campaign is deliberately thin — it holds no rules of its own, and every promotion that names it
 * inherits its window and its budget. That is why the budget lives on this path rather than on a
 * path of its own: a budget is not an aggregate an operator browses, it is the ceiling *of one
 * campaign*, and there is exactly one of it. Setting it is therefore a `PUT` that replaces, and
 * reading it returns the ceiling together with the per-value consumption rows, because a ceiling
 * that has been split by attribute cannot be understood from the ceiling alone.
 *
 * Resetting consumption is an operator action with a reason: it re-opens a budget that has been
 * spent, so who did it and why is part of the record rather than a side effect of a plain update.
 */
@ApiTags('Campaign')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
@Controller('/campaigns')
export class CampaignController extends CrudController<Campaign> {
	constructor(
		private readonly campaignService: CampaignService,
		private readonly campaignBudgetService: CampaignBudgetService
	) {
		super(campaignService);
	}

	/**
	 * Creates a campaign.
	 *
	 * @param entity The campaign to create.
	 * @returns The stored campaign.
	 */
	@ApiOperation({ summary: 'Create a campaign' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Campaign created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The identifier is missing or already used' })
	@Permissions(PromotionPermission.PROMOTIONS_CREATE as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCampaignDTO): Promise<ICampaign> {
		return this.campaignService.createCampaign(entity as never);
	}

	/**
	 * Changes the fields of a campaign.
	 *
	 * @param id The campaign to change.
	 * @param entity The fields to change.
	 * @returns The stored campaign.
	 */
	@ApiOperation({ summary: 'Update a campaign' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Campaign updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Campaign not found' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateCampaignDTO): Promise<ICampaign> {
		return this.campaignService.updateCampaign(id, entity as never);
	}

	/**
	 * Deletes a campaign.
	 *
	 * @param id The campaign to delete.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a campaign' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Campaign deleted' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Campaign not found' })
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<unknown> {
		return this.campaignService.delete(id);
	}

	/**
	 * Sets or replaces the single budget of a campaign.
	 *
	 * The ceiling is validated against its type — a currency for the spend types, an attribute for the
	 * split ones — because a money ceiling with no currency cannot be compared with a discount. The
	 * consumption already recorded is preserved: this route moves the ceiling, and resetting what has
	 * been spent is the route below.
	 *
	 * @param id The campaign whose budget is set.
	 * @param entity The ceiling to store.
	 * @returns The stored budget.
	 */
	@ApiOperation({ summary: 'Set the budget of a campaign' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Budget set' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The budget shape does not match its type' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Put(':id/budget')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async setBudget(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: CreateCampaignBudgetDTO
	): Promise<ICampaignBudget> {
		return this.campaignBudgetService.setBudget(id, entity as never);
	}

	/**
	 * Reads the budget of a campaign with its per-value consumption.
	 *
	 * @param id The campaign to read.
	 * @returns The budget and the usage rows of a budget split by attribute.
	 */
	@ApiOperation({ summary: 'Read the budget of a campaign' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Budget retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The campaign has no budget' })
	@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
	@Get(':id/budget')
	async getBudget(
		@Param('id', UUIDValidationPipe) id: ID
	): Promise<{ budget: ICampaignBudget; usage: ICampaignBudgetUsage[] }> {
		return this.campaignBudgetService.getBudget(id);
	}

	/**
	 * Resets the consumption of a campaign's budget, re-opening a ceiling that has been spent.
	 *
	 * This is the one route that makes a budget forget what it paid out, so it carries the operator's
	 * reason alongside it: the figure is reset, and the explanation is what keeps the reset an act
	 * somebody performed rather than a number that changed by itself.
	 *
	 * @param id The campaign whose budget is reset.
	 * @param body The reason the budget is being re-opened.
	 * @returns The budget after the reset.
	 */
	@ApiOperation({ summary: 'Reset the consumption of a campaign budget' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Budget consumption reset' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'No reason was given' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The campaign has no budget' })
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Post(':id/budget/reset')
	@HttpCode(HttpStatus.OK)
	async resetBudget(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: { reason?: string }
	): Promise<ICampaignBudget> {
		return this.campaignBudgetService.resetConsumption(id, body?.reason);
	}
}
