import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { CurrencyCode, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { TaxAmountType, TaxPartType } from '../tax.types';
import { TaxRate } from '../tax-rate/tax-rate.entity';
import { MikroOrmTaxRatePartRepository } from './repository/mikro-orm-tax-rate-part.repository';

/**
 * One part of a rate — the unit an accountant actually reconciles.
 *
 * A tax is not a percentage: it is an ordered list of parts, each with a base, a signed share and an
 * optional posting code. One fraction cannot say that a 20 % tax is 5 % federal and 15 % provincial, it
 * cannot carry a reduced base, it cannot state a fixed amount such as an excise or a deposit, and it
 * gives a withholding or a reverse charge nowhere to live — without the pair, a reverse-charge supply is
 * indistinguishable from a zero-rated one, which is exactly what makes the document unreconcilable.
 *
 * The membership rule is what keeps every existing rate unchanged: a rate with **no** part row is one
 * implied part (`TAX`, 100 %, base 1), so the breakdown a rate produced before parts existed is the
 * breakdown it still produces, and a part is added only where a rate genuinely needs one.
 *
 * A part has no lifecycle of its own: it is live while its rate is, and it is edited with the rate it
 * belongs to under the rate's editing permission. Its `postingKey` is deliberately not a foreign key and
 * no account table is created — mapping a posting code to an account is the receiving accounting
 * system's job and its own source of truth.
 */
/** The position of a part inside its rate is unique, so the order the arithmetic is applied in is defined. */
@ColumnIndex('UQ_tax_rate_part_seq', ['taxRateId', 'sequence'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
/** The parts of one rate, which is every read of a breakdown. */
@ColumnIndex('IDX_tax_rate_part_rate', ['taxRateId'], { where: '"deletedAt" IS NULL' })
@MultiORMEntity('tax_rate_part', { mikroOrmRepository: () => MikroOrmTaxRatePartRepository })
export class TaxRatePart extends TenantOrganizationBaseEntity {
	/**
	 * The rate this part belongs to. A part never exists outside one, so the relation is mandatory.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@MultiORMManyToOne(() => TaxRate, (rate) => rate.parts, {
		/** A part has no meaning without its rate. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	taxRate?: TaxRate;

	/**
	 * The rate's id, as the queryable column.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', relationId: true })
	taxRateId: ID;

	/**
	 * The order in which the parts are applied. The compounding base of a compound part is the already
	 * rounded amounts of the parts before it, so this is part of the definition and not a display hint.
	 */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	sequence: number;

	/**
	 * Whether the part declares a base or produces an amount. A `BASE` part exists so a rate can state
	 * more than one taxable base; a `TAX` part produces exactly one tax line for the owner.
	 */
	@ApiProperty({ type: () => String, enum: TaxPartType, default: TaxPartType.TAX })
	@IsEnum(TaxPartType)
	@MultiORMColumn({ type: 'simple-enum', enum: TaxPartType, default: TaxPartType.TAX })
	partType: TaxPartType;

	/**
	 * The share of the rate's computed amount this part carries. **Signed**: a withholding is a part with
	 * a negative share, and a reverse charge is a positive and a negative part that net to zero on one
	 * rate, both reported. The column may not be zero — a part that carries nothing is not a part.
	 */
	@ApiProperty({ type: () => Number, default: 100 })
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 9, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	factorPercent: number;

	/**
	 * The share of the owner's net-after-discount this part is computed on — the reduced base. A rate
	 * applied to half the value is not the same thing as a rate applied to all of it at half the
	 * percentage, and a jurisdiction that legislates a reduced base requires the base to appear on the
	 * document.
	 */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 9,
		scale: 6,
		default: 1,
		transformer: new ColumnNumericTransformerPipe()
	})
	baseFactor: number;

	/**
	 * How the part arrives at its amount. `FIXED` contributes `fixedAmount` per unit of the owner's
	 * quantity, which is what an excise, a deposit, an eco-fee or a stamp duty is.
	 */
	@ApiProperty({ type: () => String, enum: TaxAmountType, default: TaxAmountType.PERCENT })
	@IsEnum(TaxAmountType)
	@MultiORMColumn({ type: 'simple-enum', enum: TaxAmountType, default: TaxAmountType.PERCENT })
	amountType: TaxAmountType;

	/**
	 * The amount a fixed part contributes per unit of the owner's quantity. Non-null exactly when
	 * `amountType` is `FIXED`.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	fixedAmount?: number;

	/**
	 * Currency of the fixed amount. Every monetary column states its currency, because an amount without
	 * one is not an amount.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	fixedCurrency?: CurrencyCode;

	/**
	 * The code the receiving accounting system posts this part under, for example `VAT-OUT-20`. Not a
	 * foreign key: this platform holds no chart of accounts and must not grow one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	postingKey?: string;

	/**
	 * The printed name of the part (`Federal`, `Provincial`, `City`); it falls back to the rate's name.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	label?: string;

	/**
	 * Tenant-defined, non-indexed extras (a filing reference, the authority that legislated the part).
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;
}
