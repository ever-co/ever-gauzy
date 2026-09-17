import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany,
	MultiORMOneToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmCampaignRepository } from './repository/mikro-orm-campaign.repository';
import { CampaignStatus, ICampaign, ICampaignBudget, IPromotion } from '../promotion.types';
import { CampaignBudget } from '../campaign-budget/campaign-budget.entity';
import { Promotion } from '../promotion/promotion.entity';

/**
 * A campaign is a window and a budget, nothing more.
 *
 * It holds no rules of its own — its promotions carry them — and it exists so that a group of
 * promotions can be budgeted and switched on and off together. A promotion whose campaign window is
 * closed is inactive even when its own window is open, which is why the two window columns are
 * indexed as one tuple with the status.
 */
@MultiORMEntity('campaign', { mikroOrmRepository: () => MikroOrmCampaignRepository })
export class Campaign extends TenantOrganizationBaseEntity implements ICampaign {
	/**
	 * Stable handle used by imports and by every external caller. Unique per organization, so an
	 * import can be replayed without creating a second campaign.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	identifier: string;

	/**
	 * Operator-facing label.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * What the campaign is for.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * Lifecycle state. Only an `ACTIVE` campaign makes its promotions candidates.
	 */
	@ApiProperty({ type: () => String, enum: CampaignStatus })
	@IsEnum(CampaignStatus)
	@MultiORMColumn({ type: 'varchar', length: 16, default: CampaignStatus.DRAFT })
	status: CampaignStatus;

	/**
	 * Start of the campaign window; null means it is already open.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	startsAt?: Date;

	/**
	 * End of the campaign window, exclusive; null means it never closes.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	endsAt?: Date;

	/**
	 * Owner, cost centre and free-form notes. Open-ended by design, so it is a real JSON column
	 * rather than a column per key.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/**
	 * The campaign's budget, when it has one. One per campaign: a second budget would make "the
	 * ceiling" ambiguous, which is why the child table carries the unique index.
	 */
	@MultiORMOneToOne(() => CampaignBudget, (budget) => budget.campaign)
	budget?: ICampaignBudget;

	/**
	 * The promotions grouped by the campaign. Deleting a campaign detaches them rather than deleting
	 * them: a promotion owns a history of redemptions that outlives the grouping.
	 */
	@MultiORMOneToMany(() => Promotion, (promotion) => promotion.campaign)
	promotions?: IPromotion[];
}
