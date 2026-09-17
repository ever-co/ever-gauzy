import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';
import { MikroOrmGiftCardTransactionRepository } from './repository/mikro-orm-gift-card-transaction.repository';
import { IGiftCard, IGiftCardTransaction, GiftCardTransactionType } from '../promotion.types';
import { GiftCard } from '../gift-card/gift-card.entity';

/**
 * One movement on a gift card.
 *
 * The table is append-only and is the authority for the card's balance: `balanceAfter` records the
 * running balance, so the chain of rows can be replayed and compared with the materialised column.
 * A correction is a new `ADJUST` row — a row is never updated — and every balance change on the card
 * writes exactly one row here inside the same database transaction as the change itself.
 */
@MultiORMEntity('gift_card_transaction', { mikroOrmRepository: () => MikroOrmGiftCardTransactionRepository })
export class GiftCardTransaction extends TenantOrganizationBaseEntity implements IGiftCardTransaction {
	/**
	 * Signed amount: negative debits the card, positive credits it. The sign is the direction, so no
	 * separate direction column exists.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	amount: DecimalString;

	/**
	 * The card balance after this movement.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	balanceAfter: DecimalString;

	/**
	 * Issue, redeem, refund, adjust or expire.
	 */
	@ApiProperty({ type: () => String, enum: GiftCardTransactionType })
	@IsEnum(GiftCardTransactionType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16 })
	type: GiftCardTransactionType;

	/**
	 * Why the movement was written, for a manual correction.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * When the movement happened.
	 */
	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ type: 'timestamptz' })
	occurredAt: Date;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/**
	 * The card this movement belongs to. A ledger row is part of the card and goes with it.
	 */
	@MultiORMManyToOne(() => GiftCard, (giftCard) => giftCard.transactions, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	giftCard?: IGiftCard;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: GiftCardTransaction) => it.giftCard)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	giftCardId: ID;

	/**
	 * The order the movement settled, when it settled one. An identifier without a database
	 * constraint, because the order table is created by a package that loads after this one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	orderId?: ID;
}
