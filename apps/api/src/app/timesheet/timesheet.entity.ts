import {
	Entity,
	Index,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn
} from 'typeorm';
import { Base } from '../core/entities/base';
import { Timesheet as ITimesheet, TimesheetStatus } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsString,
	IsNotEmpty,
	IsBoolean,
	IsNumber,
	IsDateString,
	IsEnum
} from 'class-validator';
import { Employee } from '../employee/employee.entity';
import { OrganizationClients } from '../organization-clients';

@Entity('timesheet')
export class Timesheet extends Base implements ITimesheet {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee, { nullable: true })
	@JoinColumn()
	employee?: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timesheet: Timesheet) => timesheet.employee)
	readonly employeeId?: string;

	@ApiProperty({ type: OrganizationClients })
	@ManyToOne(() => OrganizationClients, { nullable: true })
	@JoinColumn()
	approvedBy?: OrganizationClients;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timesheet: Timesheet) => timesheet.approvedBy)
	readonly approvedById?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	duration: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	keyboard: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	mouse: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	overall: number;

	@ApiProperty({ type: Date })
	@IsDateString()
	@Column({ nullable: true, default: null })
	startedAt: Date;

	@ApiProperty({ type: Date })
	@IsDateString()
	@Column({ nullable: true, default: null })
	stoppedAt: Date;

	@ApiProperty({ type: Date })
	@IsDateString()
	@Column({ nullable: true, default: null })
	approvedAt: Date;

	@ApiProperty({ type: Date })
	@IsDateString()
	@Column({ nullable: true, default: null })
	submittedAt: Date;

	@ApiProperty({ type: Date })
	@IsDateString()
	@Column({ nullable: true, default: null })
	lockedAt: Date;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: false })
	isBilled: boolean;

	@ApiProperty({ type: String, enum: TimesheetStatus })
	@IsEnum(TimesheetStatus)
	@IsString()
	@Column({ default: TimesheetStatus.PENDING })
	status: string;
}
