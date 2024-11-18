import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OnLoad } from '@mikro-orm/core';
import { RelationId, JoinColumn, AfterLoad } from 'typeorm';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import moment from 'moment';
import {
	ITimeLog,
	TimeLogType,
	TimeLogSourceEnum,
	ITimesheet,
	IEmployee,
	ITask,
	IOrganizationProject,
	IOrganizationContact,
	ITimeSlot,
	IOrganizationTeam,
	ID
} from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import {
	Employee,
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
import { MikroOrmTimeLogRepository } from './repository/mikro-orm-time-log.repository';

@MultiORMEntity('time_log', { mikroOrmRepository: () => MikroOrmTimeLogRepository })
export class TimeLog extends TenantOrganizationBaseEntity implements ITimeLog {
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
	@MultiORMColumn({ type: 'timestamp' })
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
