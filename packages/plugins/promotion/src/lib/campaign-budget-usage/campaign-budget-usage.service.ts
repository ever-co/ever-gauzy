import { JoinColumn, RelationId } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CrudService, RequestContext } from '@gauzy/core';
import { ID } from '@gauzy/contracts';
import { CampaignBudgetUsage } from './campaign-budget-usage.entity';
import { TypeOrmCampaignBudgetUsageRepository } from './repository/type-orm-campaign-budget-usage.repository';
import { MikroOrmCampaignBudgetUsageRepository } from './repository/mikro-orm-campaign-budget-usage.repository';
import { ICampaignBudgetUsage } from '../promotion.types';

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
export class CampaignBudgetUsageService extends CrudService<CampaignBudgetUsage> {
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
	 * @param budgetId The budget to total.
	 * @returns The sum of the rows.
	 */
	async totalFor(budgetId: ID): Promise<string> {
		const rows = await this.findByBudget(budgetId);
		const total = rows.reduce((sum, row) => sum + Number(row.used ?? 0), 0);

		return String(total);
	}
}
