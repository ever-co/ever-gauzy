import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import {
	ID,
	IInvoice,
	IInvoiceSchedule,
	IInvoiceScheduleRun,
	InvoiceScheduleRunReasonEnum,
	InvoiceScheduleRunStatusEnum
} from '@gauzy/contracts';
import { Invoice, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { InvoiceSchedule } from './invoice-schedule.entity';
import { MikroOrmInvoiceScheduleRunRepository } from './repository/mikro-orm-invoice-schedule-run.repository';

/**
 * A run of a billing schedule: the invoice it made for one period, or why it made none.
 *
 * The row is the claim: the sweep inserts it before it builds the invoice, and the unique key on the schedule and the
 * period's first day lets one insert through, whatever the processes or instances that sweep at the same moment. The
 * one that loses gets a unique violation and builds nothing, so a period is billed once. A schedule's runs go with it;
 * an invoice deleted since leaves its run, without the link.
 */
@MultiORMEntity('invoice_schedule_run', { mikroOrmRepository: () => MikroOrmInvoiceScheduleRunRepository })
@ColumnIndex('IDX_invoice_schedule_run_schedule_period', ['invoiceScheduleId', 'periodStart'], { unique: true })
export class InvoiceScheduleRun extends TenantOrganizationBaseEntity implements IInvoiceScheduleRun {
	/** The first day of the period billed, `YYYY-MM-DD`. */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ length: 10 })
	periodStart: string;

	/** The last day of the period billed, `YYYY-MM-DD`, included. */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ length: 10 })
	periodEnd: string;

	@ApiProperty({ type: () => String, enum: InvoiceScheduleRunStatusEnum })
	@MultiORMColumn()
	status: InvoiceScheduleRunStatusEnum;

	@ApiPropertyOptional({ type: () => String, enum: InvoiceScheduleRunReasonEnum })
	@MultiORMColumn({ nullable: true })
	reason?: InvoiceScheduleRunReasonEnum | null;

	/** When a sweep claimed the run. */
	@ApiProperty({ type: () => Date })
	@MultiORMColumn()
	claimedAt: Date;

	/** When the run ended; null while it is claimed. */
	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	finishedAt?: Date | null;

	/** The period's billable time the invoice does not bill (no rate, another currency), in seconds. */
	@ApiPropertyOptional({ type: () => Number })
	@MultiORMColumn({ type: 'int', nullable: true })
	leftOutSeconds?: number | null;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/** The schedule that ran. Its runs go with it. */
	@MultiORMManyToOne(() => InvoiceSchedule, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	invoiceSchedule?: IInvoiceSchedule;

	/** Indexed by the unique key above, whose first column it is. */
	@ApiProperty({ type: () => String })
	@RelationId((it: InvoiceScheduleRun) => it.invoiceSchedule)
	@MultiORMColumn({ relationId: true })
	invoiceScheduleId: ID;

	/** The invoice the run made. Deleting the invoice keeps the run, without the link. */
	@MultiORMManyToOne(() => Invoice, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoice?: IInvoice;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceScheduleRun) => it.invoice)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	invoiceId?: ID | null;
}
