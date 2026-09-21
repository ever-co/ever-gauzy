import { DecimalAmount } from '../shared/is-decimal-amount.validator';
import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ICommerceCartPromotion, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { CommerceCart } from '../commerce-cart/commerce-cart.entity';
import { MikroOrmCommerceCartPromotionRepository } from './repository/mikro-orm-commerce-cart-promotion.repository';

/**
 * A promotion as it was applied to a cart.
 *
 * The row is a **snapshot**: deleting or editing the promotion afterwards must not remove a discount
 * the buyer has already been shown, which is why the promotion reference is nullable and the amount
 * is stored rather than derived. The set of rows is rebuilt on every totals recalculation, never
 * appended to blindly, so it always describes the cart's current promotion state.
 */
@MultiORMEntity('commerce_cart_promotion', {
	mikroOrmRepository: () => MikroOrmCommerceCartPromotionRepository
})
export class CommerceCartPromotion extends TenantOrganizationBaseEntity implements ICommerceCartPromotion {
	/** The cart the promotion was applied to. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	cartId: ID;

	/**
	 * The promotion. Nullable and constraint-free on purpose: the promotion package is installed after
	 * this one, and its removal must not delete the discount history.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	promotionId?: ID;

	/** The coupon the customer redeemed, when the promotion was code-driven. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	couponId?: ID;

	/** The code the customer entered, if any. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	code?: string;

	/** The discount this promotion produced on this cart. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	amount: DecimalAmount;

	/** True when the promotion applied without a code being entered. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isAutomatic: boolean;

	/** When the promotion was applied. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	appliedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The cart. */
	@MultiORMManyToOne(() => CommerceCart, (it) => it.promotions, { onDelete: 'CASCADE' })
	@JoinColumn()
	cart?: CommerceCart;
}
