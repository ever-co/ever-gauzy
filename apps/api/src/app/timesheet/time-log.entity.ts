import {
	Entity,
	Index,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn
} from 'typeorm';
import { Base } from '../core/entities/base';
import { TimeLog as ITimeLog, TimeLogType } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsString,
	IsNotEmpty,
	IsBoolean,
	IsDateString,
	IsEnum,
	IsNumber
} from 'class-validator';
import { Employee } from '../employee/employee.entity';
import { Timesheet } from './timesheet.entity';
import { OrganizationProjects } from '../organization-projects';
import { OrganizationClients } from '../organization-clients';
import { Task } from '../tasks';

@Entity('time_log')
export class TimeLog extends Base implements ITimeLog {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee, { nullable: true })
	@JoinColumn()
	employee: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeSlot: TimeLog) => timeSlot.employee)
	readonly employeeId?: string;

	@ApiProperty({ type: Timesheet })
	@ManyToOne(() => Timesheet, { nullable: true })
	@JoinColumn()
	timesheet: Timesheet;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeSlot: TimeLog) => timeSlot.timesheet)
	readonly timesheetId?: string;

	@ApiProperty({ type: OrganizationProjects })
	@ManyToOne(() => OrganizationProjects, { nullable: true })
	@JoinColumn()
	project?: OrganizationProjects;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeSlot: TimeLog) => timeSlot.project)
	readonly projectId?: string;

	@ApiProperty({ type: Task })
	@ManyToOne(() => Task, { nullable: true })
	@JoinColumn()
	task?: Task;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeSlot: TimeLog) => timeSlot.task)
	readonly taskId?: string;

	@ApiProperty({ type: OrganizationClients })
	@ManyToOne(() => OrganizationClients, { nullable: true })
	@JoinColumn()
	client?: OrganizationClients;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeSlot: TimeLog) => timeSlot.client)
	readonly clientId?: string;

	@ApiProperty({ type: Date })
	@IsDateString()
	@Column({ nullable: true, default: null })
	startedAt?: Date;

	@ApiProperty({ type: Date })
	@IsDateString()
	@Column({ nullable: true, default: null })
	stoppedAt?: Date;

	@ApiProperty({ type: String, enum: TimeLogType })
	@IsEnum(TimeLogType)
	@IsString()
	@Column({ default: TimeLogType.TRAKED })
	logType: string;

	@ApiProperty({ type: String })
	@IsBoolean()
	@Column({ default: null, nullable: true })
	description?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	duration: number;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: false })
	isBilled: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: false })
	isBillable: boolean;
}
