import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	ManyToMany,
	Index,
	AfterLoad
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import * as moment from 'moment';
import {
	ITimeLog,
	TimeLogType,
	TimeLogSourceEnum,
	ITimesheet,
	IEmployee,
	ITask,
	IOrganizationProject,
	IOrganizationContact,
	ITimeSlot
} from '@gauzy/contracts';
import {
	Employee,
	OrganizationContact,
	OrganizationProject,
	Task,
	TenantOrganizationBaseEntity,
	Timesheet,
	TimeSlot
} from './../../core/entities/internal';

@Entity('time_log')
export class TimeLog extends TenantOrganizationBaseEntity implements ITimeLog {

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	startedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	stoppedAt?: Date;

	@ApiProperty({ type: () => String, enum: TimeLogType, default: TimeLogType.TRACKED })
	@IsEnum(TimeLogType)
	@Index()
	@Column({ default: TimeLogType.TRACKED })
	logType: string;

	@ApiProperty({ type: () => String, enum: TimeLogSourceEnum, default: TimeLogSourceEnum.WEB_TIMER })
	@IsEnum(TimeLogSourceEnum)
	@Index()
	@Column({ default: TimeLogSourceEnum.WEB_TIMER })
	source?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	reason?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Index()
	@Column({ default: false })
	isBillable: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Index()
	@Column({ nullable: true })
	isRunning?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ update: false, nullable: true })
	version?: string;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	deletedAt?: Date;

	/** Additional fields */
	duration: number;
	isEdited?: boolean;
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ManyToOne(() => Employee, (employee) => employee.timeLogs, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TimeLog) => it.employee)
	@Index()
	@Column()
	employeeId: IEmployee['id'];

	/**
	 * Timesheet
	 */
	@ApiPropertyOptional({ type: () => Timesheet })
	@IsOptional()
	@ManyToOne(() => Timesheet, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timesheet?: ITimesheet;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TimeLog) => it.timesheet)
	@Index()
	@Column({ nullable: true })
	timesheetId?: ITimesheet['id'];

	/**
	 * OrganizationProject
	 */
	@ApiPropertyOptional({ type: () => OrganizationProject })
	@IsOptional()
	@ManyToOne(() => OrganizationProject, (project) => project.timeLogs, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((timeLog: TimeLog) => timeLog.project)
	@Index()
	@Column({ nullable: true })
	projectId?: string;

	/**
	 * Task
	 */
	@ApiPropertyOptional({ type: () => Task })
	@IsOptional()
	@ManyToOne(() => Task, (task) => task.activities, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	task?: ITask;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((timeLog: TimeLog) => timeLog.task)
	@Index()
	@Column({ nullable: true })
	taskId?: string;

	/**
	 * OrganizationContact
	 */
	@ApiPropertyOptional({ type: () => OrganizationContact })
	@IsOptional()
	@ManyToOne(() => OrganizationContact, (contact) => contact.timeLogs, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((timeLog: TimeLog) => timeLog.organizationContact)
	@Index()
	@Column({ nullable: true })
	organizationContactId?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * TimeSlot
	 */
	@ApiProperty({ type: () => TimeSlot, isArray: true })
	@ManyToMany(() => TimeSlot, (timeLogs) => timeLogs.timeLogs, {
		onUpdate: 'CASCADE',
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
	afterLoadEntity?() {
		const startedAt = moment(this.startedAt, 'YYYY-MM-DD HH:mm:ss');
		const stoppedAt = moment(this.stoppedAt || new Date(), 'YYYY-MM-DD HH:mm:ss');
		this.duration = stoppedAt.diff(startedAt, 'seconds');

		/**
		 * Check If, TimeLog is edited or not
		 */
		const createdAt = moment(this.createdAt, 'YYYY-MM-DD HH:mm:ss');
		const updatedAt = moment(this.updatedAt, 'YYYY-MM-DD HH:mm:ss');
		this.isEdited = (updatedAt.diff(createdAt, 'seconds') > 0);
	}
}
