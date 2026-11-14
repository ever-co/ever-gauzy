import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEmail, IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID, IInvoice, IInvoiceReminder } from '@gauzy/contracts';
import { Invoice, TenantOrganizationBaseEntity } from '../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';

/**
 * A payment reminder the platform emailed the client of an unpaid invoice: step 1 three days before its due date, steps
 * 2, 3 and 4 one, seven and fourteen days after it (see `invoice-reminder.rules.ts`).
 *
 * The row is the claim: the sweep inserts it before it sends the email, and the unique key on the invoice, the step and
 * the due date lets one insert through, whatever the processes or instances that sweep at the same moment. The one that
 * loses gets a unique violation and sends nothing. The due date is part of the key, so a due date moved since starts the
 * steps again. An invoice's reminders go with it.
 */
@MultiORMEntity('invoice_reminder')
@ColumnIndex('IDX_invoice_reminder_invoice_step_due_date', ['invoiceId', 'step', 'dueDate'], { unique: true })
export class InvoiceReminder extends TenantOrganizationBaseEntity implements IInvoiceReminder {
	/** 1: before the due date; 2, 3, 4: one, seven and fourteen days after it. */
	@ApiProperty({ type: () => Number })
	@IsIn([1, 2, 3, 4])
	@MultiORMColumn()
	step: number;

	/** The due date the step was counted from. */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	dueDate: Date;

	/** Where the reminder went: the address the invoice was last emailed to. */
	@ApiProperty({ type: () => String })
	@IsEmail()
	@MultiORMColumn()
	email: string;

	/** When the sweep claimed the reminder. */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	claimedAt: Date;

	/** When the mail transport took the email; unset when nothing was sent (a domain the platform never emails). */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	sentAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/** The invoice the client was reminded of. */
	@MultiORMManyToOne(() => Invoice, { onDelete: 'CASCADE' })
	invoice?: IInvoice;

	/** Indexed by the unique key above, whose first column it is. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: InvoiceReminder) => it.invoice)
	@MultiORMColumn({ relationId: true })
	invoiceId: ID;
}
