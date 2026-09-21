import { Injectable } from '@nestjs/common';
import { Money, RequestContext } from '@gauzy/core';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { CampaignBudgetUsage } from './campaign-budget-usage.entity';
import { TypeOrmCampaignBudgetUsageRepository } from './repository/type-orm-campaign-budget-usage.repository';
import { MikroOrmCampaignBudgetUsageRepository } from './repository/mikro-orm-campaign-budget-usage.repository';
import { ICampaignBudgetUsage } from '../promotion.types';
import { TenantScopedCrudService } from '../shared/tenant-scoped-crud.service';

/** The scale the `used` column holds: `numeric(20,6)`, the same one the parent budget carries. */
const BUDGET_SCALE = 6;

/** ISO 4217's "no currency" code: a usage row counts against a ceiling that may not be money at all. */
const BUDGET_NEUTRAL_CURRENCY: CurrencyCode = 'XXX';

/**
 * The per-attribute-value rows of a budget.
 *
 * The rows are maintained by the budget service inside the transaction that grants a discount, never
 * from a request: a caller that could write `used` directly could hand out budget the campaign does
 * not have. This service is therefore read-mostly — it answers the budget view — and the writes it
 * does expose are the allocation of a row and the restoration of a value on a reversal, both of
 * which go through the same conditional path the budget itself uses.
 */
@Injectable()
export class CampaignBudgetUsageService extends TenantScopedCrudService<CampaignBudgetUsage> {
	constructor(
		readonly typeOrmCampaignBudgetUsageRepository: TypeOrmCampaignBudgetUsageRepository,
		readonly mikroOrmCampaignBudgetUsageRepository: MikroOrmCampaignBudgetUsageRepository
	) {
		super(typeOrmCampaignBudgetUsageRepository, mikroOrmCampaignBudgetUsageRepository);
	}

	/**
	 * The tenant and organization of the caller.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Reads the consumption rows of one budget.
	 *
	 * @param budgetId The budget to read.
	 * @returns The per-value rows.
	 */
	async findByBudget(budgetId: ID): Promise<ICampaignBudgetUsage[]> {
		const rows = await this.typeOrmCampaignBudgetUsageRepository.find({
			where: { budgetId, ...this.scope },
			order: { attributeValue: 'ASC' }
		});

		return rows as unknown as ICampaignBudgetUsage[];
	}

	/**
	 * Reads one value's consumption, which is what an evaluation checks before it computes a discount.
	 *
	 * @param budgetId The budget.
	 * @param attributeValue The attribute value.
	 * @returns The row, or null when the value has never been consumed.
	 */
	async findValue(budgetId: ID, attributeValue: string): Promise<ICampaignBudgetUsage | null> {
		const row = await this.typeOrmCampaignBudgetUsageRepository.findOne({
			where: { budgetId, attributeValue, ...this.scope }
		});

		return (row as unknown as ICampaignBudgetUsage) ?? null;
	}

	/**
	 * The sum of the per-value rows, which is what the parent budget's `used` must equal after a
	 * commit. The nightly audit compares the two and reports a disagreement rather than repairing it
	 * silently.
	 *
	 * **The sum is exact, because the figure it is compared against is.** The parent's `used` was
	 * advanced by SQL — `used = used + :amount` on a `numeric(20,6)` column — so it holds the exact
	 * decimal total; adding the same rows up with `+` on doubles does not. Three rows of `10.000000`,
	 * `10.010000` and `0.000000` gave `'20.009999999999998'`, and the nightly audit this method exists
	 * to serve reported a disagreement that was entirely its own, for ever, with nothing to repair.
	 * A sub-microunit total came back in exponential notation, which is not a decimal string at all,
	 * so a caller that fed the result to `Money.of` was handed an exception instead of a total.
	 *
	 * @param budgetId The budget to total.
	 * @returns The sum of the rows, as an exact decimal at the storage scale.
	 */
	async totalFor(budgetId: ID): Promise<string> {
		const rows = await this.findByBudget(budgetId);

		// The usage row carries no currency — a budget split by attribute may be counting redemptions
		// rather than spending money — so the sum is taken in the ISO "no currency" code at the scale
		// the column holds. What the audit compares is the stored figure, and the stored figure is what
		// this reproduces.
		return Money.sum(
			rows.map((row) => Money.fromStorage(row.used ?? '0', BUDGET_NEUTRAL_CURRENCY, BUDGET_SCALE)),
			BUDGET_NEUTRAL_CURRENCY,
			BUDGET_SCALE
		).toStorageString();
	}
}
