import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';
import { MikroOrmCampaignBudgetUsageRepository } from './repository/mikro-orm-campaign-budget-usage.repository';
import { ICampaignBudget, ICampaignBudgetUsage } from '../promotion.types';
import { CampaignBudget } from '../campaign-budget/campaign-budget.entity';

/**
 * Consumption of one budget for one value of its attribute.
 *
 * A `SPEND_BY_ATTRIBUTE` budget caps each value separately, so this child row — not the parent — is
 * the row the conditional update gates on; the parent's `used` is then advanced by the sum in the
 * same transaction, which is what keeps the two from disagreeing after a commit.
 */
@MultiORMEntity('campaign_budget_usage', { mikroOrmRepository: () => MikroOrmCampaignBudgetUsageRepository })
export class CampaignBudgetUsage extends TenantOrganizationBaseEntity implements ICampaignBudgetUsage {
	/**
	 * The attribute value the row tracks, for example a country code or a customer group id.
	 */
	@ApiProperty({ type: () => String, maxLength: 191 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(191)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 191 })
	attributeValue: string;

	/**
	 * Consumption for that value, including amounts only reserved.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	used: DecimalString;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/**
	 * The budget this row consumes. The per-value row has no meaning without its budget.
	 */
	@MultiORMManyToOne(() => CampaignBudget, (budget) => budget.usages, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	budget?: ICampaignBudget;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: CampaignBudgetUsage) => it.budget)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	budgetId: ID;
}
