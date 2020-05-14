import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	AfterLoad
} from 'typeorm';
import { Base } from '../core/entities/base';
import { TimeLog as ITimeLog, TimeLogType } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsDateString, IsEnum } from 'class-validator';
import { Employee } from '../employee/employee.entity';
import { Timesheet } from './timesheet.entity';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import { Task } from '../tasks/task.entity';
import * as moment from 'moment';

@Entity('time_log')
export class TimeLog extends Base implements ITimeLog {
	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee, { nullable: true })
	@JoinColumn()
	employee: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeLog: TimeLog) => timeLog.employee)
	@Column()
	readonly employeeId: string;

	@ApiProperty({ type: Timesheet })
	@ManyToOne(() => Timesheet, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	timesheet?: Timesheet;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeLog: TimeLog) => timeLog.timesheet)
	@Column({ nullable: true })
	readonly timesheetId?: string;

	@ApiProperty({ type: OrganizationProjects })
	@ManyToOne(() => OrganizationProjects, { nullable: true })
	@JoinColumn()
	project?: OrganizationProjects;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeLog: TimeLog) => timeLog.project)
	@Column({ nullable: true })
	readonly projectId?: string;

	@ApiProperty({ type: Task })
	@ManyToOne(() => Task, { nullable: true })
	@JoinColumn()
	task?: Task;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeLog: TimeLog) => timeLog.task)
	@Column({ nullable: true })
	readonly taskId?: string;

	@ApiProperty({ type: OrganizationClients })
	@ManyToOne(() => OrganizationClients, { nullable: true })
	@JoinColumn()
	client?: OrganizationClients;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeLog: TimeLog) => timeLog.client)
	@Column({ nullable: true })
	readonly clientId?: string;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	startedAt?: Date;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	stoppedAt?: Date;

	@ApiProperty({ type: String, enum: TimeLogType })
	@IsEnum(TimeLogType)
	@IsString()
	@Column({ default: TimeLogType.TRACKED })
	logType: string;

	@ApiProperty({ type: String })
	@IsBoolean()
	@Column({ default: null, nullable: true })
	description?: string;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ default: false })
	isBillable: boolean;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	deletedAt?: Date;

	duration: number;

	@AfterLoad()
	getDuration() {
		const end = this.stoppedAt ? this.stoppedAt : new Date();
		this.duration = moment(end).diff(moment(this.startedAt), 'seconds');
	}
}
