import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PromotionPermission } from '../../promotion.permissions';
import { CampaignBudgetType, ICampaign, ICampaignBudget, ICampaignBudgetCreateInput, IPromotion } from '../../promotion.types';
import { CampaignService } from '../../campaign/campaign.service';
import { CampaignBudgetService } from '../../campaign-budget/campaign-budget.service';
import { PromotionService } from '../../promotion/promotion.service';
import { toUserError, toWhere } from '../wire';
import {
	CreateCampaignPayload,
	DeleteCampaignPayload,
	ICreateCampaignInput,
	IPageInput,
	ISortInput,
	IUpdateCampaignBudgetInput,
	IUpdateCampaignInput,
	UpdateCampaignBudgetPayload,
	UpdateCampaignPayload,
	cursorOffset,
	toConnection,
	toOrder,
	toWindow
} from '../types';

/**
 * The column each sortable field of a campaign page names.
 */
const CAMPAIGN_SORT_COLUMNS: Readonly<Record<string, string>> = {
	IDENTIFIER: 'identifier',
	NAME: 'name',
	STATUS: 'status',
	STARTS_AT: 'startsAt',
	ENDS_AT: 'endsAt',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

/**
 * Campaigns over GraphQL.
 *
 * A campaign is a window and a ceiling and holds no rules of its own, which is why the mutation that
 * sets its budget lives on this resolver rather than on a resolver of its own: a budget is not an
 * aggregate a caller browses, it is the ceiling *of one campaign*, and there is exactly one of it.
 *
 * Setting the ceiling is a merge with what the campaign already carries, because the schema's input
 * states every member as optional and promises that an omitted one keeps its stored value. The shape
 * is still validated where it has always been validated — by the budget service, on the ceiling it is
 * handed — so a type that is changed without the member that type needs is refused with the domain's
 * own code rather than silently stored.
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
@Resolver('Campaign')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
export class CampaignResolver {
	constructor(
		private readonly campaignService: CampaignService,
		private readonly campaignBudgetService: CampaignBudgetService,
		private readonly promotionService: PromotionService
	) {}

	/**
	 * Lists the campaigns of the caller's organization.
	 *
	 * @param filter How the listing is narrowed.
	 * @param sort How the listing is ordered.
	 * @param page The cursor window, when the caller walks one.
	 * @param limit The page size, when the caller states one instead.
	 * @param offset The offset, when the caller states one instead.
	 * @param withDeleted Whether retired rows are included.
	 * @returns One page of campaigns.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
	@Query('campaigns')
	async campaigns(
		@Args('filter') filter?: Record<string, unknown>,
		@Args('sort') sort?: ISortInput,
		@Args('page') page?: IPageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const order = toOrder(sort, CAMPAIGN_SORT_COLUMNS);
		const result = await this.campaignService.findCampaigns({
			where: toWhere(filter),
			...(order ? { order } : {}),
			...toWindow(page, limit, offset),
			...(withDeleted ? { withDeleted: true } : {})
		});

		return toConnection(result, cursorOffset(page, offset));
	}

	/**
	 * Reads one campaign by id.
	 *
	 * @param id The campaign to read.
	 * @returns The campaign, or null when it is not the caller's.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
	@Query('campaign')
	async campaign(@Args('id') id: ID): Promise<ICampaign | null> {
		try {
			return await this.campaignService.findCampaignOrFail(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Creates a campaign.
	 *
	 * @param input The campaign to create.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_CREATE as PermissionsEnum)
	@Mutation('createCampaign')
	async createCampaign(@Args('input') input: ICreateCampaignInput): Promise<CreateCampaignPayload> {
		try {
			return { campaign: await this.campaignService.createCampaign(input), operation: null, userErrors: [] };
		} catch (error) {
			return { campaign: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Changes the fields of a campaign.
	 *
	 * @param id The campaign to change.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Mutation('updateCampaign')
	async updateCampaign(
		@Args('id') id: ID,
		@Args('input') input: IUpdateCampaignInput
	): Promise<UpdateCampaignPayload> {
		try {
			return { campaign: await this.campaignService.updateCampaign(id, input), operation: null, userErrors: [] };
		} catch (error) {
			return { campaign: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Deletes a campaign.
	 *
	 * @param id The campaign to delete.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Mutation('deleteCampaign')
	async deleteCampaign(@Args('id') id: ID): Promise<DeleteCampaignPayload> {
		try {
			const campaign = await this.campaignService.findCampaignOrFail(id);
			await this.campaignService.delete(id);

			return { campaign, operation: null, userErrors: [] };
		} catch (error) {
			return { campaign: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Sets or replaces the single budget of a campaign.
	 *
	 * @param campaignId The campaign whose ceiling is set.
	 * @param input The ceiling to store; an omitted member keeps its stored value.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Mutation('updateCampaignBudget')
	async updateCampaignBudget(
		@Args('campaignId') campaignId: ID,
		@Args('input') input: IUpdateCampaignBudgetInput
	): Promise<UpdateCampaignBudgetPayload> {
		try {
			const stored = await this.storedBudget(campaignId);
			const ceiling = this.toCeiling(input, stored);

			if (!ceiling) {
				return {
					budget: null,
					operation: null,
					userErrors: [
						{
							code: 'CAMPAIGN_BUDGET_INVALID',
							message:
								'CAMPAIGN_BUDGET_INVALID: a campaign that has no budget yet cannot be given one without its ceiling.',
							path: ['input', 'limit'],
							details: null
						}
					]
				};
			}

			return {
				budget: await this.campaignBudgetService.setBudget(campaignId, ceiling),
				operation: null,
				userErrors: []
			};
		} catch (error) {
			return { budget: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * The single ceiling of the campaign.
	 *
	 * @param campaign The campaign being read.
	 * @returns The budget and its per-value consumption, or null when the campaign has none.
	 */
	@ResolveField('budget')
	async budget(@Parent() campaign: ICampaign): Promise<ICampaignBudget | null> {
		if (campaign.budget) {
			return campaign.budget;
		}

		try {
			const { budget } = await this.campaignBudgetService.getBudget(campaign.id);

			return budget;
		} catch (error) {
			return null;
		}
	}

	/**
	 * The promotions the campaign bounds.
	 *
	 * @param campaign The campaign being read.
	 * @returns The promotions.
	 */
	@ResolveField('promotions')
	async promotions(@Parent() campaign: ICampaign): Promise<IPromotion[]> {
		if (Array.isArray(campaign.promotions)) {
			return campaign.promotions;
		}

		const page = await this.promotionService.findPromotions({ where: { campaignId: campaign.id } });

		return page.items;
	}

	/**
	 * The ceiling a campaign already carries.
	 *
	 * @param campaignId The campaign to read.
	 * @returns The budget, or null when the campaign has none yet.
	 */
	private async storedBudget(campaignId: ID): Promise<ICampaignBudget | null> {
		try {
			const { budget } = await this.campaignBudgetService.getBudget(campaignId);

			return budget;
		} catch (error) {
			return null;
		}
	}

	/**
	 * The ceiling to store: what the caller stated, over what the campaign already carries.
	 *
	 * A ceiling is validated against its type — a currency for the spend types, an attribute for the
	 * split ones — so a ceiling whose type changes drops the member the new type does not use instead
	 * of carrying it over and being refused for a shape the caller never wrote.
	 *
	 * @param input The ceiling the caller stated.
	 * @param stored The ceiling the campaign already carries, when it has one.
	 * @returns The ceiling to store, or null when there is no ceiling to store yet.
	 */
	private toCeiling(
		input: IUpdateCampaignBudgetInput,
		stored: ICampaignBudget | null
	): ICampaignBudgetCreateInput | null {
		const limit = input?.limit ?? stored?.limit;

		if (!limit) {
			return null;
		}

		const type = input?.type ?? stored?.type ?? CampaignBudgetType.SPEND;
		const byAttribute =
			type === CampaignBudgetType.SPEND_BY_ATTRIBUTE || type === CampaignBudgetType.USAGE_BY_ATTRIBUTE;

		return {
			type,
			limit,
			attribute: byAttribute ? input?.attribute ?? stored?.attribute : undefined,
			currency: input?.currency ?? stored?.currency
		};
	}
}
