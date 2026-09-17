import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DecimalString, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { PromotionPermission } from '../../promotion.permissions';
import { ICampaignBudget, ICampaignBudgetUsage } from '../../promotion.types';
import { CampaignBudgetService } from '../../campaign-budget/campaign-budget.service';
import { toDecimal } from '../wire';

/**
 * Per-value budget consumption over GraphQL.
 *
 * A row here is not an aggregate a caller browses: it is one value of a budget's attribute and what
 * has been consumed against it, and it is reached the way an operator reaches it — through the ceiling
 * it belongs to, as `CampaignBudget.usages` or `Campaign.budget { usages }`. That is the whole of the
 * surface: the write routes the REST controller exposes are a repair path for a drifted row, and a
 * figure written there changes what the next reservation against that value may take, so nothing on
 * this resolver writes one.
 *
 * The row is the gate. A consumption against a value is admitted by a conditional statement on this
 * row and the parent ceiling is advanced by the same amount in the same transaction, which is what
 * keeps an exhausted value from blocking the others.
 */
@Resolver('CampaignBudgetUsage')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
export class CampaignBudgetUsageResolver {
	constructor(private readonly campaignBudgetService: CampaignBudgetService) {}

	/**
	 * The ceiling this consumption belongs to.
	 *
	 * @param usage The row being read.
	 * @returns The budget, or null when it has since been removed.
	 */
	@ResolveField('budget')
	async budget(@Parent() usage: ICampaignBudgetUsage): Promise<ICampaignBudget | null> {
		if (usage.budget) {
			return usage.budget;
		}

		try {
			return await this.campaignBudgetService.findBudgetOrFail(usage.budgetId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * The consumption against one value of the budget's attribute.
	 *
	 * The column is `numeric(20,6)` and is read through the platform's numeric transformer, which hands
	 * over a number; the schema declares a `Decimal`, so the value is rendered as an exact decimal here
	 * rather than exposed as a float.
	 *
	 * @param usage The row being read.
	 * @returns The consumption.
	 */
	@ResolveField('used')
	used(@Parent() usage: ICampaignBudgetUsage): DecimalString {
		return toDecimal(usage.used) ?? '0.000000';
	}
}
