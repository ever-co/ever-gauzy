import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';
import { MikroOrmGiftCardRepository } from './repository/mikro-orm-gift-card.repository';
import { IGiftCard, IGiftCardTransaction, GiftCardStatus } from '../promotion.types';
import { GiftCardTransaction } from '../gift-card-transaction/gift-card-transaction.entity';

/**
 * A stored-value instrument.
 *
 * The card is a liability: value is issued once and spent down through an append-only ledger, so
 * `balance` here is a materialised cache of that ledger and never the authority. Every balance
 * change writes exactly one `gift_card_transaction` in the same transaction as the change, the
 * redemption path locks the card row and re-reads the balance before it debits it, and a card is
 * never hard-deleted — it is `CANCELED` — because its history is part of the accounting record.
 *
 * `pin` is an optional second factor and is stored hashed; it is never returned by a read.
 */
@MultiORMEntity('gift_card', { mikroOrmRepository: () => MikroOrmGiftCardRepository })
export class GiftCard extends TenantOrganizationBaseEntity implements IGiftCard {
	/**
	 * The redeemable string. Generated from the platform alphabet when a caller does not supply one.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * Face value at issue.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	initialAmount: DecimalString;

	/**
	 * Current balance: `initialAmount` plus the sum of the card's transactions. Written only by the
	 * ledger path, and re-derived from the ledger by the nightly audit.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	balance: DecimalString;

	/**
	 * The card currency. A card is only redeemable against an order in it: no conversion is ever
	 * applied to stored value.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: string;

	/**
	 * Active, redeemed, expired or canceled. `REDEEMED` is set when the balance reaches zero.
	 */
	@ApiProperty({ type: () => String, enum: GiftCardStatus })
	@IsEnum(GiftCardStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: GiftCardStatus.ACTIVE })
	status: GiftCardStatus;

	/**
	 * Expiry instant. Null means the card never expires; past it, new redemptions are refused.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	expiresAt?: Date;

	/**
	 * The optional second factor, stored hashed and never selected on a read. It is required only
	 * when the tenant has switched the requirement on.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true, select: false })
	pin?: string;

	/**
	 * Reloadable marker, issuer, recipient and message.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

	/**
	 * The registered holder of the card.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	customerId?: ID;

	/**
	 * The order that issued the card, on a refund-to-stored-value flow.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	orderId?: ID;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/**
	 * The card's ledger. Append-only: a correction is an `ADJUST` row, never an edit.
	 */
	@MultiORMOneToMany(() => GiftCardTransaction, (transaction) => transaction.giftCard)
	transactions?: IGiftCardTransaction[];
}
