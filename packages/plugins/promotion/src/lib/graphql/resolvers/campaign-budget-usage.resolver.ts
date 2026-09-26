import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DecimalString, ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PromotionPermission } from '../../promotion.permissions';
import { ICampaignBudget, ICampaignBudgetUsage } from '../../promotion.types';
import { CampaignBudgetService } from '../../campaign-budget/campaign-budget.service';
import { CampaignBudgetUsageService } from '../../campaign-budget-usage/campaign-budget-usage.service';
import { toDecimal, toUserError } from '../wire';
import {
	RecoverCampaignBudgetUsagePayload,
	SoftDeleteCampaignBudgetUsagePayload
} from '../types';

/**
 * Per-value budget consumption over GraphQL.
 *
 * A row here is not an aggregate a caller browses: it is one value of a budget's attribute and what
 * has been consumed against it, and it is read the way an operator reads it — through the ceiling it
 * belongs to, as `CampaignBudget.usages` or `Campaign.budget { usages }`. It now carries a root write
 * as well, and only one kind: the inherited `DELETE /:id/soft` and `PUT /:id/recover` pair, which this
 * controller serves with a permission attached exactly as its eight siblings do. The repair routes the
 * controller exposes for a drifted figure stay REST-only, because a consumption written by hand
 * changes what the next reservation against that value may take and belongs to the checkout path.
 *
 * The row is the gate. A consumption against a value is admitted by a conditional statement on this
 * row and the parent ceiling is advanced by the same amount in the same transaction, which is what
 * keeps an exhausted value from blocking the others.
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver('CampaignBudgetUsage')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
export class CampaignBudgetUsageResolver {
	constructor(
		private readonly campaignBudgetService: CampaignBudgetService,
		private readonly campaignBudgetUsageService: CampaignBudgetUsageService
	) {}

	/**
	 * Retires one per-value consumption row recoverably.
	 *
	 * The route it mirrors is `DELETE /campaign-budget-usages/:id/soft`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base leaves unstated. The row is
	 * retired and not reset: giving the value its headroom back is a reconciliation's decision, and this
	 * pair is about whether the row is visible at all.
	 *
	 * The permission is the route's own, `PROMOTIONS_DELETE`, and not the class-level view grant.
	 *
	 * @param id The consumption row to retire.
	 * @returns The payload, carrying the row as the soft delete left it.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Mutation('softDeleteCampaignBudgetUsage')
	async softDeleteCampaignBudgetUsage(@Args('id') id: ID): Promise<SoftDeleteCampaignBudgetUsagePayload> {
		try {
			return { budgetUsage: await this.campaignBudgetUsageService.softRemove(id), operation: null, userErrors: [] };
		} catch (error) {
			return { budgetUsage: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a per-value consumption row that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /campaign-budget-usages/:id/recover`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base leaves unstated. A restored
	 * row counts against its value again, which is why the route states the destructive grant rather
	 * than the edit one.
	 *
	 * @param id The consumption row to restore.
	 * @returns The payload, carrying the restored row.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Mutation('recoverCampaignBudgetUsage')
	async recoverCampaignBudgetUsage(@Args('id') id: ID): Promise<RecoverCampaignBudgetUsagePayload> {
		try {
			return { budgetUsage: await this.campaignBudgetUsageService.softRecover(id), operation: null, userErrors: [] };
		} catch (error) {
			return { budgetUsage: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

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
