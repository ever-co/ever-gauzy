import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ID } from '@gauzy/contracts';
import { MikroOrmCouponRepository } from './repository/mikro-orm-coupon.repository';
import { ICoupon, IPromotion, IPromotionUsage } from '../promotion.types';
import { Promotion } from '../promotion/promotion.entity';
import { PromotionUsage } from '../promotion-usage/promotion-usage.entity';

/**
 * A redeemable code belonging to a promotion.
 *
 * It is a table rather than a second `code` column on the promotion because a mailing produces
 * thousands of codes that share one offer, each with its own window, its own usage cap and its own
 * per-customer cap. A coupon with no promotion is valid but grants nothing: the service rejects the
 * redemption instead of silently ignoring the code.
 *
 * `isActive` is inherited from the base entity and is the coupon's own on/off switch, independent of
 * the promotion's status.
 */
@MultiORMEntity('coupon', { mikroOrmRepository: () => MikroOrmCouponRepository })
export class Coupon extends TenantOrganizationBaseEntity implements ICoupon {
	/**
	 * The code the customer types. Stored upper-cased, so `save10` and `SAVE10` cannot both exist.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * Groups the coupons produced by one mailing, so a batch can be exported or deactivated as a unit.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	batchId?: string;

	/**
	 * Per-code redemption cap. Null inherits the promotion's own limit.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', nullable: true })
	usageLimit?: number;

	/**
	 * Redemptions so far, including reservations, so a code cannot be oversold while a checkout runs.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	usageCount: number;

	/**
	 * Per-code, per-customer cap.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', nullable: true })
	perCustomerLimit?: number;

	/**
	 * Start of the code window; intersected with the promotion window.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	startsAt?: Date;

	/**
	 * End of the code window, exclusive.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	endsAt?: Date;

	/**
	 * Issued-to, mailing and single-use markers.
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
	 * The promotion a redemption of this code grants.
	 */
	@MultiORMManyToOne(() => Promotion, (promotion) => promotion.coupons, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	promotion?: IPromotion;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Coupon) => it.promotion)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	promotionId?: ID;

	/**
	 * The redemptions made with the code.
	 */
	@MultiORMOneToMany(() => PromotionUsage, (usage) => usage.coupon)
	usages?: IPromotionUsage[];
}
