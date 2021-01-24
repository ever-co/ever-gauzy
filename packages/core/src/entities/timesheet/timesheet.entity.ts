import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	OneToMany
} from 'typeorm';
import { ITimesheet, TimesheetStatus } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsString,
	IsBoolean,
	IsNumber,
	IsDateString,
	IsEnum
} from 'class-validator';
import { Employee, TenantOrganizationBaseEntity, TimeLog } from '../internal';

@Entity('timesheet')
export class Timesheet
	extends TenantOrganizationBaseEntity
	implements ITimesheet {
	constructor(input?: DeepPartial<Timesheet>) {
		super(input);
	}

	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee, { nullable: true })
	@JoinColumn()
	employee: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timesheet: Timesheet) => timesheet.employee)
	@Column()
	readonly employeeId?: string;

	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee, { nullable: true })
	@JoinColumn()
	approvedBy?: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timesheet: Timesheet) => timesheet.approvedBy)
	@Column({ nullable: true })
	readonly approvedById?: string;

	@ApiProperty({ type: TimeLog })
	@OneToMany(() => TimeLog, (timeLog) => timeLog.timesheet)
	@JoinColumn()
	timeLogs?: TimeLog[];

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	duration?: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	keyboard?: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	mouse?: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	overall?: number;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	startedAt?: Date;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	stoppedAt?: Date;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	approvedAt?: Date;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	submittedAt?: Date;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	lockedAt?: Date;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: false })
	isBilled?: boolean;

	@ApiProperty({ type: String, enum: TimesheetStatus })
	@IsEnum(TimesheetStatus)
	@IsString()
	@Column({ default: TimesheetStatus.PENDING })
	status: string;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	deletedAt?: Date;
}
