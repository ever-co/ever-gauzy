import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	ManyToMany,
	Index
} from 'typeorm';
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
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsDateString, IsEnum, IsOptional } from 'class-validator';
import {
	Employee,
	OrganizationContact,
	OrganizationProject,
	Task,
	TenantOrganizationBaseEntity,
	Timesheet,
	TimeSlot
} from '../core/entities/internal';

@Entity('time_log')
export class TimeLog extends TenantOrganizationBaseEntity implements ITimeLog {

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	startedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	stoppedAt?: Date;

	@ApiProperty({ type: () => String, enum: TimeLogType })
	@IsEnum(TimeLogType)
	@IsString()
	@Column({ default: TimeLogType.TRACKED })
	logType: string;

	@ApiProperty({ type: () => String, enum: TimeLogSourceEnum })
	@IsEnum(TimeLogSourceEnum)
	@IsString()
	@Column({ default: TimeLogSourceEnum.BROWSER })
	source?: string;

	@ApiProperty({ type: () => String })
	@IsBoolean()
	@Column({ default: null, nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@IsBoolean()
	@Column({ default: null, nullable: true })
	reason?: string;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: false })
	isBillable: boolean;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	deletedAt?: Date;

	duration: number;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, { nullable: true })
	@JoinColumn()
	employee: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: TimeLog) => it.employee)
	@IsString()
	@Index()
	@Column()
	readonly employeeId: string;

	/**
	 * Timesheet
	 */
	@ApiProperty({ type: () => Timesheet })
	@ManyToOne(() => Timesheet, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	timesheet?: ITimesheet;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: TimeLog) => it.timesheet)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	readonly timesheetId?: string;

	/**
	 * OrganizationProject
	 */
	@ApiProperty({ type: () => OrganizationProject })
	@ManyToOne(() => OrganizationProject, { nullable: true })
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((timeLog: TimeLog) => timeLog.project)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	readonly projectId?: string;

	/**
	 * Task
	 */
	@ApiProperty({ type: () => Task })
	@ManyToOne(() => Task, { nullable: true })
	@JoinColumn()
	task?: ITask;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((timeLog: TimeLog) => timeLog.task)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	readonly taskId?: string;

	/**
	 * OrganizationContact
	 */
	@ApiProperty({ type: () => OrganizationContact })
	@ManyToOne(() => OrganizationContact, { nullable: true })
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((timeLog: TimeLog) => timeLog.organizationContact)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	readonly organizationContactId?: string;


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
}
