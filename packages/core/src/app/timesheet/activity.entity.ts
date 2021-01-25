import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	CreateDateColumn,
	AfterLoad
} from 'typeorm';
import {
	IActivity,
	ActivityType,
	TimeLogSourceEnum,
	IURLMetaData,
	IEmployee,
	ITask,
	ITimeSlot,
	IOrganizationProject
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsString,
	IsEnum,
	IsOptional,
	IsNumber,
	IsDateString
} from 'class-validator';
import {
	Employee,
	OrganizationProject,
	Task,
	TenantOrganizationBaseEntity,
	TimeSlot
} from '../core/entities/internal';
import { getConfig } from '@gauzy/config';
const config = getConfig();

@Entity('activity')
export class Activity
	extends TenantOrganizationBaseEntity
	implements IActivity {
	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee)
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((activity: Activity) => activity.employee)
	@Column()
	employeeId?: string;

	@ApiProperty({ type: OrganizationProject })
	@ManyToOne(() => OrganizationProject, { nullable: true })
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((activity: Activity) => activity.project)
	@Column({ nullable: true })
	projectId?: string;

	@ApiProperty({ type: TimeSlot })
	@ManyToOne(() => TimeSlot, { nullable: true })
	@JoinColumn()
	timeSlot?: ITimeSlot;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((activity: Activity) => activity.timeSlot)
	@Column({ nullable: true })
	timeSlotId?: string;

	@ApiProperty({ type: Task })
	@ManyToOne(() => Task, { nullable: true })
	@JoinColumn()
	task?: ITask;

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
	@Column({
		nullable: true,
		type: config.dbConnectionOptions.type === 'sqlite' ? 'text' : 'json'
	})
	metaData?: string | IURLMetaData;

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
