import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';
import { MikroOrmPromotionRepository } from './repository/mikro-orm-promotion.repository';
import { IPromotion, IPromotionAction, IPromotionUsage, ICoupon, ICampaign, PromotionStatus, PromotionType } from '../promotion.types';
import { Campaign } from '../campaign/campaign.entity';
import { PromotionAction } from '../promotion-action/promotion-action.entity';
import { Coupon } from '../coupon/coupon.entity';
import { PromotionUsage } from '../promotion-usage/promotion-usage.entity';

/**
 * A promotion.
 *
 * The table holds the offer, not its conditions: eligibility is expressed as `rule` rows with owner
 * type `PROMOTION` and scope `ORDER`, `ITEM` or `SHIPPING`, target and buy selection as rows with
 * owner type `PROMOTION_ACTION`, and the money the offer moves lands in the core `adjustment` ledger.
 * Nothing here duplicates any of that — a promotion that carried its own condition columns would be
 * a second, disagreeing definition of what "matches" means.
 *
 * The counters (`usageCount`, `budgetSpent`) are caches of the usage ledger and are re-derived by the
 * nightly usage audit; the limits are checked against the ledger, never against the counters alone.
 */
@MultiORMEntity('promotion', { mikroOrmRepository: () => MikroOrmPromotionRepository })
export class Promotion extends TenantOrganizationBaseEntity implements IPromotion {
	/**
	 * Optional promotional code. A promotion with no code and `isAutomatic` set applies itself when
	 * its rules match; a coded promotion is reached through a `coupon` row or through this column.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	code?: string;

	/**
	 * Customer-facing name of the offer.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	title: string;

	/**
	 * What the offer gives, in the operator's words.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * The shape of the offer, which decides the action types that are legal for it.
	 */
	@ApiProperty({ type: () => String, enum: PromotionType })
	@IsEnum(PromotionType)
	@MultiORMColumn({ type: 'varchar', length: 16, default: PromotionType.STANDARD })
	type: PromotionType;

	/**
	 * Lifecycle state. Only an `ACTIVE` promotion is a candidate.
	 */
	@ApiProperty({ type: () => String, enum: PromotionStatus })
	@IsEnum(PromotionStatus)
	@MultiORMColumn({ type: 'varchar', length: 16, default: PromotionStatus.DRAFT })
	status: PromotionStatus;

	/**
	 * When true the promotion applies without a code as soon as its rules match.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isAutomatic: boolean;

	/**
	 * When false the promotion closes its stacking group as soon as it wins.
	 */
	@ApiProperty({ type: () => Boolean, default: true })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	isCombinable: boolean;

	/**
	 * Group key for the combination policy: promotions sharing a value compete, and the first
	 * non-combinable winner closes the group to the rest.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	stackingGroup?: string;

	/**
	 * Ordering weight. Lower runs earlier, and buy-and-get promotions run before all of them because
	 * they create the free units no later promotion may discount again.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	priority: number;

	/**
	 * Currency the fixed-amount actions are restricted to. Null means the promotion is
	 * currency-agnostic; a non-null value that differs from the cart currency excludes the promotion
	 * with a notice rather than applying a `15.00` discount to a different currency.
	 */
	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	currency?: string;

	/**
	 * Start of the promotion window; intersected with the campaign window when one is attached.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	startsAt?: Date;

	/**
	 * End of the promotion window, exclusive.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	endsAt?: Date;

	/**
	 * Global redemption cap; null means unlimited.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', nullable: true })
	usageLimit?: number;

	/**
	 * Registered redemptions so far, a cache of the usage ledger.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	usageCount: number;

	/**
	 * Redemption cap per customer. Checked against `promotion_usage` filtered by customer, never
	 * against a counter, because a per-customer limit is a fact about the ledger.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', nullable: true })
	perCustomerUsageLimit?: number;

	/**
	 * Inline budget for a promotion that has no campaign. Checked together with the campaign budget
	 * when both exist; the effective headroom is the smaller of the two.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	budgetAmount?: DecimalString;

	/**
	 * Consumption of the inline budget.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	budgetSpent: DecimalString;

	/**
	 * Whether the discount is computed on the tax-inclusive amount. It is the basis of the adjustment
	 * rows the promotion writes, and the tax split follows from it.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxInclusive: boolean;

	/**
	 * Funding mode, revert-on-return policy, badge text and terms. Open-ended, so a JSON column
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
	 * The campaign whose window and budget bound this promotion. Optional, and detached — not
	 * deleted — when the campaign is removed.
	 */
	@MultiORMManyToOne(() => Campaign, (campaign) => campaign.promotions, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	campaign?: ICampaign;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Promotion) => it.campaign)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	campaignId?: ID;

	/**
	 * Sales channel the promotion is restricted to. Null means every channel.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	channelId?: ID;

	/**
	 * Contact group the promotion is restricted to. Null means every customer.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	customerGroupId?: ID;

	/**
	 * What the promotion does. At least one action is required: a promotion with no effect is a
	 * configuration mistake, not a no-op.
	 */
	@MultiORMOneToMany(() => PromotionAction, (action) => action.promotion)
	actions?: IPromotionAction[];

	/**
	 * The codes that grant this promotion.
	 */
	@MultiORMOneToMany(() => Coupon, (coupon) => coupon.promotion)
	coupons?: ICoupon[];

	/**
	 * Every application of the promotion, reserved, registered or reverted.
	 */
	@MultiORMOneToMany(() => PromotionUsage, (usage) => usage.promotion)
	usages?: IPromotionUsage[];
}
