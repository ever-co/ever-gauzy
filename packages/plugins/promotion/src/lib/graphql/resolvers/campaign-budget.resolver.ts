import { Args, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { filter } from 'rxjs';
import { DecimalString, ID, PermissionsEnum } from '@gauzy/contracts';
import { EventBus, FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PromotionPermission } from '../../promotion.permissions';
import { ICampaign, ICampaignBudget, ICampaignBudgetUsage } from '../../promotion.types';
import { PromotionBudgetExhaustedEvent } from '../../events';
import { CampaignService } from '../../campaign/campaign.service';
import { CampaignBudgetService } from '../../campaign-budget/campaign-budget.service';
import { CampaignBudgetUsageService } from '../../campaign-budget-usage/campaign-budget-usage.service';
import { toDecimal, toWhere } from '../wire';
import {
	IPageInput,
	IPromotionBudgetExhaustedPayload,
	ISortInput,
	cursorOffset,
	toAsyncIterable,
	toConnection,
	toOrder,
	toWindow
} from '../types';

/**
 * The column each sortable field of a budget page names.
 */
const CAMPAIGN_BUDGET_SORT_COLUMNS: Readonly<Record<string, string>> = {
	TYPE: 'type',
	LIMIT: 'limit',
	USED: 'used',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

/**
 * Campaign ceilings over GraphQL.
 *
 * A budget is reachable from its campaign as well as from this listing, because the two callers are
 * different: an operator maintaining one campaign reads it through `Campaign.budget`, while a
 * reconciliation walks the ceilings here, one page at a time.
 *
 * The consumption column is **not** writable on either surface. `used` is a cache of the usage ledger
 * — the checkout advances it through a single conditional statement and a reversal gives it back — so
 * a hand-written value would be overwritten by the next reconciliation, and re-opening a ceiling is
 * the campaign's own operation rather than an edit of this row.
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
@Resolver('CampaignBudget')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
export class CampaignBudgetResolver {
	constructor(
		private readonly campaignBudgetService: CampaignBudgetService,
		private readonly campaignBudgetUsageService: CampaignBudgetUsageService,
		private readonly campaignService: CampaignService,
		private readonly eventBus: EventBus
	) {}

	/**
	 * Lists the campaign ceilings of the caller's organization.
	 *
	 * @param filter How the listing is narrowed.
	 * @param sort How the listing is ordered.
	 * @param page The cursor window, when the caller walks one.
	 * @param limit The page size, when the caller states one instead.
	 * @param offset The offset, when the caller states one instead.
	 * @returns One page of ceilings.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
	@Query('campaignBudgets')
	async campaignBudgets(
		@Args('filter') filter?: Record<string, unknown>,
		@Args('sort') sort?: ISortInput,
		@Args('page') page?: IPageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	) {
		const order = toOrder(sort, CAMPAIGN_BUDGET_SORT_COLUMNS);
		const result = await this.campaignBudgetService.findBudgets({
			where: toWhere(filter),
			...(order ? { order } : {}),
			...toWindow(page, limit, offset)
		});

		return toConnection(result, cursorOffset(page, offset));
	}

	/**
	 * Streams the campaigns whose budget reached its ceiling, optionally narrowed to one promotion or
	 * one budget.
	 *
	 * The event is raised by the evaluation path when a reservation is refused, which is the moment an
	 * operator can still act: a budget reported as spent at the end of the month cannot be topped up in
	 * time.
	 *
	 * @param promotionId The promotion to narrow the stream to, when the caller wants one.
	 * @param budgetId The budget to narrow the stream to, when the caller wants one.
	 * @returns The stream.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
	@Subscription('promotionBudgetExhausted')
	promotionBudgetExhausted(
		@Args('promotionId') promotionId?: ID,
		@Args('budgetId') budgetId?: ID
	): AsyncIterable<IPromotionBudgetExhaustedPayload> {
		const source = this.eventBus.ofType(PromotionBudgetExhaustedEvent);

		return toAsyncIterable(
			source.pipe(
				filter(
					(event) =>
						(!promotionId || event.promotionId === promotionId) && (!budgetId || event.budgetId === budgetId)
				)
			)
		);
	}

	/**
	 * The campaign the ceiling belongs to.
	 *
	 * @param budget The budget being read.
	 * @returns The campaign, or null when it has since been removed.
	 */
	@ResolveField('campaign')
	async campaign(@Parent() budget: ICampaignBudget): Promise<ICampaign | null> {
		if (budget.campaign) {
			return budget.campaign;
		}

		try {
			return await this.campaignService.findCampaignOrFail(budget.campaignId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * The per-value consumption of a ceiling that is split by attribute.
	 *
	 * @param budget The budget being read.
	 * @returns The consumption rows, one per value of the budget's attribute.
	 */
	@ResolveField('usages')
	async usages(@Parent() budget: ICampaignBudget): Promise<ICampaignBudgetUsage[]> {
		if (Array.isArray(budget.usages)) {
			return budget.usages;
		}

		return await this.campaignBudgetUsageService.findByBudget(budget.id);
	}

	/**
	 * The ceiling: money for the spend types, a count for the usage types.
	 *
	 * The column is `numeric(20,6)` and is read through the platform's numeric transformer, which hands
	 * over a number; the schema declares a `Decimal`, so the value is rendered as an exact decimal here
	 * rather than exposed as a float.
	 *
	 * @param budget The budget being read.
	 * @returns The ceiling.
	 */
	@ResolveField('limit')
	limit(@Parent() budget: ICampaignBudget): DecimalString {
		return toDecimal(budget.limit) ?? '0.000000';
	}

	/**
	 * The consumption so far, including reservations.
	 *
	 * @param budget The budget being read.
	 * @returns The consumption.
	 */
	@ResolveField('used')
	used(@Parent() budget: ICampaignBudget): DecimalString {
		return toDecimal(budget.used) ?? '0.000000';
	}
}
