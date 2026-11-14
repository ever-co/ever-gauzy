import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OnLoad } from '@mikro-orm/core';
import { RelationId, JoinColumn, AfterLoad } from 'typeorm';
import { Exclude } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import * as moment from 'moment';
import {
	ITimeLog,
	ITimeLogStoredRates,
	TimeLogType,
	TimeLogSourceEnum,
	ITimesheet,
	IEmployee,
	ITask,
	IOrganizationProject,
	IOrganizationContact,
	ITimeSlot,
	IOrganizationTeam,
	IInvoiceItem,
	ID
} from '@gauzy/contracts';
import { isBetterSqlite3, isMySQL } from '@gauzy/config';
import {
	Employee,
	InvoiceItem,
	OrganizationContact,
	OrganizationProject,
	OrganizationTeam,
	Task,
	TenantOrganizationBaseEntity,
	Timesheet,
	TimeSlot
} from './../../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	VirtualMultiOrmColumn
} from '../../core/decorators/entity';
import { billingRateColumn } from '../../shared/pipes/billing-rate.transform';
import { MikroOrmTimeLogRepository } from './repository/mikro-orm-time-log.repository';

/**
 * The organization-wide statistics filter on no employee, hence the second index.
 * Both are built by `AddTimeLogAndTimeSlotCompositeIndexes1790000024000`.
 */
@ColumnIndex('IDX_time_log_tenant_org_employee_started', ['tenantId', 'organizationId', 'employeeId', 'startedAt'])
@ColumnIndex('IDX_time_log_tenant_org_started', ['tenantId', 'organizationId', 'startedAt'])
@MultiORMEntity('time_log', { mikroOrmRepository: () => MikroOrmTimeLogRepository })
export class TimeLog extends TenantOrganizationBaseEntity implements ITimeLog, ITimeLogStoredRates {
	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	startedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	stoppedAt?: Date;

	/**
	 * Edited timestamp column
	 */
	@MultiORMColumn({ type: isBetterSqlite3() ? 'text' : 'timestamp' })
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	editedAt?: Date;

	@ApiProperty({ type: () => String, enum: TimeLogType, default: TimeLogType.TRACKED })
	@IsEnum(TimeLogType)
	@ColumnIndex()
	@MultiORMColumn({ default: TimeLogType.TRACKED })
	logType?: TimeLogType;

	@ApiProperty({ type: () => String, enum: TimeLogSourceEnum, default: TimeLogSourceEnum.WEB_TIMER })
	@IsEnum(TimeLogSourceEnum)
	@ColumnIndex()
	@MultiORMColumn({ default: TimeLogSourceEnum.WEB_TIMER })
	source?: TimeLogSourceEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({
		nullable: true,
		...(isMySQL() ? { type: 'longtext' } : {})
	})
	description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	reason?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ default: false })
	isBillable?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	isRunning?: boolean;

	/**
	 * Version of the sources (Desktop/Web/Extension/Mobile) timer
	 */
	@ApiPropertyOptional({ type: () => String, example: '1.0.1' })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ update: false, nullable: true })
	version?: string;

	/*
	|--------------------------------------------------------------------------
	| The rates that price the log, recorded with it (see time-log-rates.ts)
	|--------------------------------------------------------------------------
	*/

	/** The member's billing rate when the log was recorded. It prices the log's time while `ratesStored` is true. */
	@ApiPropertyOptional({ type: () => Number, nullable: true, readOnly: true })
	@MultiORMColumn(billingRateColumn())
	billRateValue?: number | null;

	/** The billing rate's currency. Empty, the organization's. */
	@ApiPropertyOptional({ type: () => String, nullable: true, readOnly: true })
	@MultiORMColumn({ nullable: true })
	billRateCurrency?: string | null;

	/**
	 * Whether the log stores the rates that price it. Every log the API records does; a row written around it (a
	 * restored archive) does not, and is priced at the current rates, as all time was before rates were stored.
	 */
	@ApiPropertyOptional({ type: () => Boolean, nullable: true, readOnly: true })
	@MultiORMColumn({ nullable: true })
	ratesStored?: boolean | null;

	/** The member's pay rate when the log was recorded. Salary data: no generic read selects or serializes it. */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ ...billingRateColumn(), select: false, hidden: true })
	payRateValue?: number | null;

	/** The pay rate's currency. Empty, the organization's. */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true, select: false, hidden: true })
	payRateCurrency?: string | null;

	/** The project's client rate when the log was recorded. Read by rate editors only, as on the project. */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ ...billingRateColumn(), select: false, hidden: true })
	projectBillRateValue?: number | null;

	/** The member's client rate on the project when the log was recorded, over the project's. */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ ...billingRateColumn(), select: false, hidden: true })
	projectMemberBillRateValue?: number | null;

	/** The currency of the project's client rate: the project's when it was stored, else the organization's. */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true, select: false, hidden: true })
	projectBillRateCurrency?: string | null;

	/** The currency of the member's client rate on the project, kept apart: each client rate changes on its own. */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true, select: false, hidden: true })
	projectMemberBillRateCurrency?: string | null;

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	duration: number;

	/**
	 * Indicates whether the TimeLog has been edited.
	 * If the value is true, it means the TimeLog has been edited.
	 * If the value is false or undefined, it means the TimeLog has not been edited.
	 */
	@VirtualMultiOrmColumn()
	isEdited?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee relationship
	 */
	@MultiORMManyToOne(() => Employee, (it) => it.timeLogs, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TimeLog) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: ID;

	/**
	 * Timesheet relationship
	 */
	@MultiORMManyToOne(() => Timesheet, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timesheet?: ITimesheet;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TimeLog) => it.timesheet)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	timesheetId?: ID;

	/**
	 * Organization Project Relationship
	 */
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.timeLogs, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	project?: IOrganizationProject;

	/**
	 * Organization Project ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TimeLog) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: ID;

	/**
	 * Task
	 */
	@MultiORMManyToOne(() => Task, (it) => it.timeLogs, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	task?: ITask;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TimeLog) => it.task)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	taskId?: ID;

	/**
	 * OrganizationContact
	 */
	@MultiORMManyToOne(() => OrganizationContact, (it) => it.timeLogs, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TimeLog) => it.organizationContact)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationContactId?: ID;

	/**
	 * Organization Team
	 */
	@MultiORMManyToOne(() => OrganizationTeam, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	organizationTeam?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TimeLog) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationTeamId?: ID;

	/**
	 * The invoice line that bills this time. The link alone does not make the time invoiced: it is only while the
	 * line and its invoice are live and the invoice is not void, so a void or deleted invoice frees the time and
	 * the link stays as a record until another line bills it. Deleting the line clears the link.
	 */
	@MultiORMManyToOne(() => InvoiceItem, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoiceItem?: IInvoiceItem;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TimeLog) => it.invoiceItem)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	invoiceItemId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * TimeSlot
	 */
	@MultiORMManyToMany(() => TimeSlot, (it) => it.timeLogs, {
		/** Database cascade action on update. */
		onUpdate: 'CASCADE',
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	timeSlots?: ITimeSlot[];

	/*
	|--------------------------------------------------------------------------
	| @EventSubscriber
	|--------------------------------------------------------------------------
	*/

	/**
	 * Called after entity is loaded.
	 */
	@AfterLoad()
	@OnLoad()
	afterEntityLoad?() {
		const startedAt = moment(this.startedAt, 'YYYY-MM-DD HH:mm:ss');
		const stoppedAt = moment(this.stoppedAt || new Date(), 'YYYY-MM-DD HH:mm:ss');
		this.duration = stoppedAt.diff(startedAt, 'seconds');

		/**
		 * Sets the 'isEdited' property based on the presence of 'editedAt'.
		 * If 'editedAt' is defined, 'isEdited' is set to true; otherwise, it is set to false.
		 */
		if ('editedAt' in this) {
			this.isEdited = !!this.editedAt;
		}
	}
}
