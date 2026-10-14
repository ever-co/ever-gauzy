import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CommerceCheckoutSessionStatus, ICommerceCheckoutSession, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { CommerceCart } from '../commerce-cart/commerce-cart.entity';
import { MikroOrmCommerceCheckoutSessionRepository } from './repository/mikro-orm-commerce-checkout-session.repository';

/**
 * The state of an in-progress checkout.
 *
 * Optional by design: a single-request checkout never creates one. When a checkout is multi-step or
 * hosted elsewhere, this row carries the step reached, the input accumulated so far and the durable
 * operation that was started, and it expires on its own schedule — independent of the cart's — so an
 * abandoned attempt cannot hold a cart open indefinitely.
 */
@MultiORMEntity('commerce_checkout_session', {
	mikroOrmRepository: () => MikroOrmCommerceCheckoutSessionRepository
})
export class CommerceCheckoutSession extends TenantOrganizationBaseEntity implements ICommerceCheckoutSession {
	/** The cart being converted. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	cartId: ID;

	/** Where the session is in its own lifecycle. */
	@ApiProperty({ type: () => String, enum: CommerceCheckoutSessionStatus })
	@IsEnum(CommerceCheckoutSessionStatus)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: CommerceCheckoutSessionStatus,
		default: CommerceCheckoutSessionStatus.STARTED
	})
	status: CommerceCheckoutSessionStatus;

	/** The step key the session is currently on: `CART`, `ADDRESSES`, `SHIPPING`, `PAYMENT`, `REVIEW`. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	step?: string;

	/** The steps already completed, in the order they were completed. Append-only. */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@MultiORMColumn({ nullable: true, type: 'simple-array' })
	completedSteps?: string[];

	/**
	 * The input accumulated across the steps: partial addresses, provider selections, the accepted
	 * terms. Read whole by the checkout operation; no dialect-specific JSON operator is used on it.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	data?: Record<string, unknown>;

	/** The session's lifetime, independent of the cart's. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	expiresAt?: Date;

	/**
	 * The durable `CHECKOUT_COMPLETE` operation this session started. Written once and never
	 * repointed, so polling the session always reaches the same operation.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	operationId?: ID;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The cart. */
	@MultiORMManyToOne(() => CommerceCart, (it) => it.checkoutSessions, { onDelete: 'CASCADE' })
	@JoinColumn()
	cart?: CommerceCart;
}
