import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import {
	ID,
	IInvoiceSchedule,
	IInvoiceSchedulePeriod,
	IInvoiceScheduleRun,
	IOrganizationContact,
	IUser,
	InvoiceScheduleFrequencyEnum,
	InvoiceScheduleGroupingEnum
} from '@gauzy/contracts';
import { OrganizationContact, TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmInvoiceScheduleRepository } from './repository/mikro-orm-invoice-schedule.repository';

/**
 * A client's billing schedule: every week, every two weeks or every month from a start day, the API builds the invoice
 * of the period just ended from the client's billable time not billed yet, priced as a manual invoice, groups its lines
 * by project, member or task, and keeps it as a draft or emails it (`sendInvoice`). A client has one schedule at most.
 *
 * The runs act with the access of the schedule's author (whoever created or last changed it), read again at each run:
 * an author who can no longer make invoices of the organization makes none, and the run says so.
 */
@MultiORMEntity('invoice_schedule', { mikroOrmRepository: () => MikroOrmInvoiceScheduleRepository })
@ColumnIndex('IDX_invoice_schedule_organization_contact', ['organizationContactId'], { unique: true })
export class InvoiceSchedule extends TenantOrganizationBaseEntity implements IInvoiceSchedule {
	@ApiProperty({ type: () => String, enum: InvoiceScheduleFrequencyEnum })
	@MultiORMColumn()
	frequency: InvoiceScheduleFrequencyEnum;

	/** The first day of the first period, `YYYY-MM-DD`: a day, not an instant, counted in the organization's zone. */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ length: 10 })
	startDay: string;

	@ApiProperty({ type: () => String, enum: InvoiceScheduleGroupingEnum })
	@MultiORMColumn({ default: InvoiceScheduleGroupingEnum.PROJECT })
	grouping: InvoiceScheduleGroupingEnum;

	/** Whether each invoice is emailed to the client and marked Sent; kept as a draft otherwise. */
	@ApiProperty({ type: () => Boolean, default: false })
	@MultiORMColumn({ default: false })
	sendInvoice: boolean;

	/** When the schedule was paused; null while it runs. */
	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	pausedAt?: Date | null;

	/** Its creation or its last resume: a period whose run day came before it is not billed. */
	@ApiProperty({ type: () => Date })
	@MultiORMColumn()
	activeSince: Date;

	/** The next period to be billed. Computed when read, never stored. */
	nextPeriod?: IInvoiceSchedulePeriod | null;

	/** The latest run. Read with the schedule, never stored on it. */
	lastRun?: IInvoiceScheduleRun | null;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/** The client billed. Its schedule goes with it. */
	@MultiORMManyToOne(() => OrganizationContact, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	/** Indexed by the unique key above, whose only column it is. */
	@ApiProperty({ type: () => String })
	@RelationId((it: InvoiceSchedule) => it.organizationContact)
	@MultiORMColumn({ relationId: true })
	organizationContactId: ID;

	/** The user whose access the runs use. A schedule whose author's account is deleted keeps its runs failing. */
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	author?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceSchedule) => it.author)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	authorId?: ID | null;
}
