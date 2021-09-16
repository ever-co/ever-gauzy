import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	OneToMany,
	Index
} from 'typeorm';
import { IEmployee, ITimeLog, ITimesheet, TimesheetStatus } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsString,
	IsBoolean,
	IsNumber,
	IsDateString,
	IsEnum
} from 'class-validator';
import {
	Employee,
	TenantOrganizationBaseEntity,
	TimeLog
} from './../../core/entities/internal';

@Entity('timesheet')
export class Timesheet
	extends TenantOrganizationBaseEntity
	implements ITimesheet {
	
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	duration?: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	keyboard?: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	mouse?: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	overall?: number;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	startedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	stoppedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	approvedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	submittedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	lockedAt?: Date;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: false })
	isBilled?: boolean;

	@ApiProperty({ type: () => String, enum: TimesheetStatus })
	@IsEnum(TimesheetStatus)
	@IsString()
	@Column({ default: TimesheetStatus.PENDING })
	status: string;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	deletedAt?: Date;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, (employee) => employee.timesheets, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Timesheet) => it.employee)
	@IsString()
	@Index()
	@Column()
	readonly employeeId?: string;

	/**
	 * Approve By Employee
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, { nullable: true })
	@JoinColumn()
	approvedBy?: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Timesheet) => it.approvedBy)
	@IsString()
	@Index()
	@Column({ nullable: true })
	readonly approvedById?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * TimeLog
	 */
	@ApiProperty({ type: () => TimeLog, isArray: true })
	@OneToMany(() => TimeLog, (timeLog) => timeLog.timesheet, {
		cascade: true
	})
	@JoinColumn()
	timeLogs?: ITimeLog[];
}
