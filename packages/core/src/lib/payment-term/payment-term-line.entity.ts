import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { RelationId } from 'typeorm';
import { CurrencyCode, DecimalString, ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne
} from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { PaymentTerm } from './payment-term.entity';
import { PaymentDueBasis, PaymentTermLineType } from './payment-term.enums';
import { MikroOrmPaymentTermLineRepository } from './repository/mikro-orm-payment-term-line.repository';

/**
 * One instalment of a term.
 *
 * The line states a share of the total — a percentage, or a fixed amount with its own currency — and
 * the basis its due date is counted from. It deliberately does **not** state the document it applies
 * to: a term is shared by every document settled against it, and the amount an instalment carries is
 * derived from the document's own total each time it is asked for, which is why editing a term cannot
 * rewrite a settled document.
 *
 * `dayOfMonth` is non-null exactly when the basis is `DAY_OF_NEXT_MONTH`, and `currency` is non-null
 * exactly when the type is `FIXED`. Both pairings are check constraints in the schema, and the service
 * re-states them so the failure names the rule rather than the constraint.
 */
@MultiORMEntity('payment_term_line', { mikroOrmRepository: () => MikroOrmPaymentTermLineRepository })
export class PaymentTermLine extends TenantOrganizationBaseEntity {
	/**
	 * The term this instalment belongs to.
	 */
	@ApiProperty({ type: () => PaymentTerm })
	@MultiORMManyToOne(() => PaymentTerm, (paymentTerm) => paymentTerm.lines, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	paymentTerm?: PaymentTerm;

	/**
	 * Id of the term. Indexed, and the leading column of the sequence uniqueness rule.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: PaymentTermLine) => it.paymentTerm)
	@ColumnIndex()
	@MultiORMColumn({ nullable: false, relationId: true })
	paymentTermId: ID;

	/**
	 * The order of the instalments, and the order they are presented in.
	 */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	sequence: number;

	/**
	 * How `valueAmount` is read.
	 */
	@ApiProperty({ type: () => String, enum: PaymentTermLineType, default: PaymentTermLineType.PERCENT })
	@IsEnum(PaymentTermLineType)
	@MultiORMColumn({ type: 'varchar', length: 16, default: PaymentTermLineType.PERCENT })
	valueType: PaymentTermLineType;

	/**
	 * A percentage in `[0,100]` for `PERCENT`, an amount for `FIXED`.
	 *
	 * Stored as an exact decimal at scale six, so a percentage such as `33.333333` is representable and
	 * the allocation that reads it is exact.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: 'numeric', precision: 9, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	valueAmount: DecimalString;

	/**
	 * The fixed amount's currency. Non-null exactly when the type is `FIXED`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	currency?: CurrencyCode;

	/**
	 * Where the due date is counted from.
	 */
	@ApiProperty({ type: () => String, enum: PaymentDueBasis, default: PaymentDueBasis.INVOICE_DATE })
	@IsEnum(PaymentDueBasis)
	@MultiORMColumn({ type: 'varchar', length: 32, default: PaymentDueBasis.INVOICE_DATE })
	dueBasis: PaymentDueBasis;

	/**
	 * Days added after the basis.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	days: number;

	/**
	 * The day of the following month the instalment falls on, `1`–`31`. Non-null exactly when the
	 * basis is `DAY_OF_NEXT_MONTH`.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'smallint', nullable: true })
	dayOfMonth?: number;

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
