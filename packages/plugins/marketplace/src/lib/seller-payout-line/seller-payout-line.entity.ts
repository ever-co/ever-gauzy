import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { CurrencyCode, DecimalString, ID, ISellerPayoutLine, JsonData } from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmSellerPayoutLineRepository } from './repository/mikro-orm-seller-payout-line.repository';
import { SellerPayout } from '../seller-payout/seller-payout.entity';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';

/**
 * The join between a payout and one ledger row it pays.
 *
 * Deliberately thin — the amount is a portion of the transaction's net and everything else about the
 * money is already on the transaction, so duplicating it here would create two versions of one
 * figure. The line exists to make three things provable:
 *
 * - the lines sum to the payout's own amount, so a payout's total is derived rather than asserted;
 * - a transaction is in **at most one live payout**, which is a database guarantee and not a hope
 *   about the scheduler's memory, so a double run cannot pay a seller twice;
 * - cancelling a payout soft-deletes its lines in the same transaction that returns the transactions
 *   to settleable, which is what releases them for the next run.
 */
@MultiORMEntity('seller_payout_line', { mikroOrmRepository: () => MikroOrmSellerPayoutLineRepository })
export class SellerPayoutLine extends TenantOrganizationBaseEntity implements ISellerPayoutLine {
	/**
	 * The portion of the transaction's net paid by this payout. It equals the transaction's net while
	 * one payout covers the transaction in full, which is the normal case.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6 })
	amount: DecimalString;

	/**
	 * Currency of the amount, always the payout's own: a payout is built for one seller in one currency
	 * and by nothing else.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	note?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/**
	 * The payout the line belongs to. Cascades: a line without its payout is not a record of anything.
	 */
	@MultiORMManyToOne(() => SellerPayout, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	sellerPayout?: SellerPayout;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@RelationId((it: SellerPayoutLine) => it.sellerPayout)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	sellerPayoutId: ID;

	/**
	 * The ledger row being paid. Restricted: a transaction covered by a payout must not disappear from
	 * under the payout that accounts for it.
	 */
	@MultiORMManyToOne(() => SellerTransaction, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	sellerTransaction?: SellerTransaction;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@RelationId((it: SellerPayoutLine) => it.sellerTransaction)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	sellerTransactionId: ID;
}
