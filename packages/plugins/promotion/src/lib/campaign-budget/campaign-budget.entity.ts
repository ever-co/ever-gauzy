import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';
import { MikroOrmCampaignBudgetRepository } from './repository/mikro-orm-campaign-budget.repository';
import { CampaignBudgetType, ICampaign, ICampaignBudget, ICampaignBudgetUsage } from '../promotion.types';
import { Campaign } from '../campaign/campaign.entity';
import { CampaignBudgetUsage } from '../campaign-budget-usage/campaign-budget-usage.entity';

/**
 * The ceiling of one campaign, in money or in redemptions.
 *
 * `used` is a materialised cache of `promotion_usage`, never an authority: it is incremented by a
 * single conditional update that fails when the ceiling would be crossed, so two concurrent
 * checkouts cannot both consume the last unit of budget, and the nightly audit re-derives it from
 * the usage ledger and reports any drift it finds instead of trusting the column.
 */
@MultiORMEntity('campaign_budget', { mikroOrmRepository: () => MikroOrmCampaignBudgetRepository })
export class CampaignBudget extends TenantOrganizationBaseEntity implements ICampaignBudget {
	/**
	 * What the ceiling counts.
	 */
	@ApiProperty({ type: () => String, enum: CampaignBudgetType })
	@IsEnum(CampaignBudgetType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32, default: CampaignBudgetType.SPEND })
	type: CampaignBudgetType;

	/**
	 * The ceiling: money for the `SPEND` types, a whole count for the `USAGE` types.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	limit: DecimalString;

	/**
	 * Consumption so far, including amounts only reserved. Maintained by the conditional update in
	 * the budget service and re-derived by the reconciliation job; never written by a caller.
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

	/**
	 * Context attribute path the budget is split by. Required for the `*_BY_ATTRIBUTE` types and
	 * rejected for the others, because a per-value ceiling without a value has no meaning.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128, nullable: true })
	attribute?: string;

	/**
	 * Currency of the ceiling. Required for the `SPEND` types, because a money ceiling without a
	 * currency cannot be compared with a discount.
	 */
	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	currency?: string;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/**
	 * The campaign the budget belongs to. The relation owns the foreign key, so the budget cannot
	 * exist without a campaign and a deleted campaign takes its budget with it.
	 */
	@MultiORMManyToOne(() => Campaign, (campaign) => campaign.budget, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	campaign?: ICampaign;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: CampaignBudget) => it.campaign)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	campaignId: ID;

	/**
	 * Per-attribute-value consumption, for the two `*_BY_ATTRIBUTE` types.
	 */
	@MultiORMOneToMany(() => CampaignBudgetUsage, (usage) => usage.budget)
	usages?: ICampaignBudgetUsage[];
}
