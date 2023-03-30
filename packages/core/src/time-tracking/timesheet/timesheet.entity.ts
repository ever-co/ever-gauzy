import { Entity, Column, RelationId, ManyToOne, JoinColumn, Index } from 'typeorm';
import { IEmployee, ITimesheet, IUser, TimesheetStatus } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Employee, TenantOrganizationBaseEntity, User } from './../../core/entities/internal';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';

@Entity('timesheet')
export class Timesheet extends TenantOrganizationBaseEntity implements ITimesheet {
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@Column({ default: 0 })
	duration?: number;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@Column({ default: 0 })
	keyboard?: number;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@Column({ default: 0 })
	mouse?: number;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@Column({ default: 0 })
	overall?: number;

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

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	approvedAt?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	submittedAt?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	lockedAt?: Date;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Index()
	@Column({ default: false })
	isBilled?: boolean;

	@ApiPropertyOptional({ type: () => String, enum: TimesheetStatus, default: TimesheetStatus.PENDING })
	@IsOptional()
	@IsEnum(TimesheetStatus)
	@Index()
	@Column({ default: TimesheetStatus.PENDING })
	status: string;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	deletedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee
	 */
	@ApiPropertyOptional({ type: () => Employee })
	@IsOptional()
	@ManyToOne(() => Employee, (employee) => employee.timesheets, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Timesheet) => it.employee)
	@Index()
	@Column()
	employeeId?: IEmployee['id'];

	/**
	 * Approve By Employee
	 */
	@ApiPropertyOptional({ type: () => Employee })
	@IsOptional()
	@ManyToOne(() => User)
	@JoinColumn()
	approvedBy?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Timesheet) => it.approvedBy)
	@Index()
	@Column({ nullable: true })
	approvedById?: IUser['id'];
}
