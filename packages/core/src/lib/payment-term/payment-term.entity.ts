import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { PaymentTermLine } from './payment-term-line.entity';
import { MikroOrmPaymentTermRepository } from './repository/mikro-orm-payment-term.repository';

/**
 * The schedule a document is settled against.
 *
 * An integer `paymentTermsDays` is net-N and nothing else: it cannot express `2/10 net 30`, a deposit
 * at order with the balance on delivery, a `30/60/90` schedule, or end-of-month dating — the ordinary
 * B2B conventions asked for in the first week of a real deployment, each of which would otherwise
 * arrive as another integer column and another branch in the invoice bridge. A term is also an
 * **object many parties share**: without it, the same 30/60 agreement is retyped on every contact and
 * cannot be corrected in one place.
 *
 * The term is deliberately **not** the schedule. It names the agreement; the instalments a document
 * actually owes are derived from it at the moment they are asked for, from the document's own total
 * and basis date. That is why there is no stored instalment table on the document: a projection turned
 * into a ledger would be a second answer to "how much is due" beside the document's own `amountDue`.
 *
 * There is no validity window and no status column, and both omissions are deliberate. The document's
 * own basis date is a stronger guarantee than a window — a window would be a second, weaker answer to
 * "which term applied" — and a second state machine would need its own reconciler.
 */
@MultiORMEntity('payment_term', { mikroOrmRepository: () => MikroOrmPaymentTermRepository })
export class PaymentTerm extends TenantOrganizationBaseEntity {
	/**
	 * `Net 30`, `30/70`, `Deposit 30/70`.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * Machine key, unique per organization.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * Printed on the invoice when the invoice has no terms text of its own.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * The organization's default term: the one a document with no other answer is settled against.
	 * At most one per organization.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDefault: boolean;

	/**
	 * The instalments, in presentation order.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@MultiORMOneToMany(() => PaymentTermLine, (line) => line.paymentTerm, {
		onDelete: 'CASCADE'
	})
	lines?: PaymentTermLine[];

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
