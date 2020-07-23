import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	CreateDateColumn,
	AfterLoad
} from 'typeorm';
import { Base } from '../core/entities/base';
import {
	Activity as IActivity,
	ActivityType,
	TimeLogSourceEnum,
	URLMetaData
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsString,
	IsEnum,
	IsOptional,
	IsNumber,
	IsDateString
} from 'class-validator';
import { TimeSlot } from './time-slot.entity';
import { Employee } from '../employee/employee.entity';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { Task } from '../tasks/task.entity';

@Entity('activity')
export class Activity extends Base implements IActivity {
	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee)
	@JoinColumn()
	employee?: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((activity: Activity) => activity.employee)
	@Column()
	employeeId?: string;

	@ApiProperty({ type: OrganizationProjects })
	@ManyToOne(() => OrganizationProjects, { nullable: true })
	@JoinColumn()
	project?: OrganizationProjects;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((activity: Activity) => activity.project)
	@Column({ nullable: true })
	projectId?: string;

	@ApiProperty({ type: TimeSlot })
	@ManyToOne(() => TimeSlot, { nullable: true })
	@JoinColumn()
	timeSlot?: TimeSlot;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((activity: Activity) => activity.timeSlot)
	@Column({ nullable: true })
	timeSlotId?: string;

	@ApiProperty({ type: Task })
	@ManyToOne(() => Task, { nullable: true })
	@JoinColumn()
	task?: Task;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((activity: Activity) => activity.task)
	@Column({ nullable: true })
	taskId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	title: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: 'json' })
	@IsDateString()
	@Column({ nullable: true, type: 'json' })
	metaData?: string | URLMetaData;

	@ApiProperty({ type: 'date' })
	@IsDateString()
	@CreateDateColumn({ type: 'date' })
	date: string;

	@ApiProperty({ type: 'time' })
	@IsDateString()
	@CreateDateColumn({ type: 'time' })
	time: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ default: 0 })
	duration?: number;

	@ApiProperty({ type: String, enum: ActivityType })
	@IsEnum(ActivityType)
	@IsOptional()
	@Column({ nullable: true })
	type?: string;

	@ApiProperty({ type: String, enum: TimeLogSourceEnum })
	@IsEnum(TimeLogSourceEnum)
	@IsString()
	@Column({ default: TimeLogSourceEnum.BROWSER })
	source?: string;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	deletedAt?: Date;

	@AfterLoad()
	getStoppedAt?() {
		if (typeof this.metaData === 'string') {
			try {
				this.metaData = JSON.parse(this.metaData);
			} catch (error) {
				this.metaData = {};
			}
		}
	}
}
