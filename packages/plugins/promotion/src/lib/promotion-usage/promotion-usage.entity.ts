import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';
import { MikroOrmPromotionUsageRepository } from './repository/mikro-orm-promotion-usage.repository';
import { ICoupon, IPromotion, IPromotionUsage, PromotionUsageStatus } from '../promotion.types';
import { Promotion } from '../promotion/promotion.entity';
import { Coupon } from '../coupon/coupon.entity';

/**
 * One application of a promotion.
 *
 * This is the row the limits and the budgets are checked against, and it is written before the money
 * moves: it is `RESERVED` while a cart is being checked out, promoted to `REGISTERED` when the order
 * is placed, and moved to `REVERTED` on cancellation, expiry or a return policy that returns the
 * benefit. A reverted row is never deleted — the audit trail is the point — and the partial unique
 * index over the live rows is what makes "once per order" a schema fact while still letting a
 * customer who cancelled re-order.
 *
 * `orderId` and `cartId` are identifiers without a database constraint, because the order and cart
 * tables are created by packages that load after this one; the constraint is added by the set that
 * owns the target (see the migration note in the package README).
 */
@MultiORMEntity('promotion_usage', { mikroOrmRepository: () => MikroOrmPromotionUsageRepository })
export class PromotionUsage extends TenantOrganizationBaseEntity implements IPromotionUsage {
	/**
	 * The code actually presented, snapshotted so the ledger still reads correctly after a code is
	 * retired.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	code?: string;

	/**
	 * The discount granted by this redemption, in the order currency.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	amount: DecimalString;

	/**
	 * Currency of the discount. Always present, so a usage row can be summed without reading its
	 * order.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: string;

	/**
	 * When the row was created, which is the reservation instant, not the order instant.
	 */
	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ })
	usedAt: Date;

	/**
	 * Reserved, registered or reverted.
	 */
	@ApiProperty({ type: () => String, enum: PromotionUsageStatus })
	@IsEnum(PromotionUsageStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: PromotionUsageStatus.RESERVED })
	status: PromotionUsageStatus;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/**
	 * The promotion that was applied. Usage without its promotion is meaningless, so the row goes
	 * with it.
	 */
	@MultiORMManyToOne(() => Promotion, (promotion) => promotion.usages, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	promotion?: IPromotion;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: PromotionUsage) => it.promotion)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	promotionId: ID;

	/**
	 * The coupon the redemption came through, when one did. Detached rather than deleted when a code
	 * is retired, so the usage keeps its history.
	 */
	@MultiORMManyToOne(() => Coupon, (coupon) => coupon.usages, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	coupon?: ICoupon;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PromotionUsage) => it.coupon)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	couponId?: ID;

	/**
	 * The order the usage was registered against. Null while the usage is only reserved.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	orderId?: ID;

	/**
	 * The cart the usage is reserved for, which is what makes a re-evaluation of the same cart
	 * idempotent rather than double-counted.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	cartId?: ID;

	/**
	 * The customer the usage belongs to. A guest is keyed by the lower-cased cart email until the
	 * guest authenticates, at which point the same row follows the customer.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	customerId?: ID;
}
