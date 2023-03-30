import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	CreateDateColumn,
	Index
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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsString,
	IsEnum,
	IsOptional,
	IsNumber,
	IsDateString,
	IsUUID
} from 'class-validator';
import { getConfig } from '@gauzy/config';
import {
	Employee,
	OrganizationProject,
	Task,
	TenantOrganizationBaseEntity,
	TimeSlot
} from './../../core/entities/internal';

let options: TypeOrmModuleOptions;
try {
	options = getConfig().dbConnectionOptions
} catch (error) { }

@Entity('activity')
export class Activity extends TenantOrganizationBaseEntity implements IActivity {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	title: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => options.type === 'sqlite' ? 'text' : 'json' })
	@IsOptional()
	@IsString()
	@Column({
		nullable: true,
		type: options.type === 'sqlite' ? 'text' : 'json'
	})
	metaData?: string | IURLMetaData;

	@ApiProperty({ type: () => 'date' })
	@IsDateString()
	@Index()
	@CreateDateColumn({ type: 'date' })
	date: string;

	@ApiProperty({ type: () => 'time' })
	@IsDateString()
	@Index()
	@CreateDateColumn({ type: 'time' })
	time: string;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@Column({ default: 0 })
	duration?: number;

	@ApiPropertyOptional({ type: () => String, enum: ActivityType })
	@IsOptional()
	@IsEnum(ActivityType)
	@Index()
	@Column({ nullable: true })
	type?: string;

	@ApiPropertyOptional({
		type: () => String,
		enum: TimeLogSourceEnum,
		default: TimeLogSourceEnum.WEB_TIMER
	})
	@IsOptional()
	@IsEnum(TimeLogSourceEnum)
	@Index()
	@Column({ default: TimeLogSourceEnum.WEB_TIMER })
	source?: string;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	recordedAt?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Column({ nullable: true })
	deletedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Employee Activity
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Activity) => it.employee)
	@Index()
	@Column({ nullable: false })
	employeeId?: IEmployee['id'];

	/**
	 * Organization Project Activity
	 */
	@ApiProperty({ type: () => OrganizationProject })
	@ManyToOne(() => OrganizationProject, (project) => project.activities, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Activity) => it.project)
	@Index()
	@Column({ nullable: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * Time Slot Activity
	 */
	@ApiProperty({ type: () => TimeSlot })
	@ManyToOne(() => TimeSlot, (timeSlot) => timeSlot.activities, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timeSlot?: ITimeSlot;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Activity) => it.timeSlot)
	@Index()
	@Column({ nullable: true })
	timeSlotId?: ITimeSlot['id'];

	/**
	 * Task Activity
	 */
	@ApiPropertyOptional({ type: () => Task })
	@IsOptional()
	@ManyToOne(() => Task, (task) => task.activities, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	task?: ITask;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Activity) => it.task)
	@Index()
	@Column({ nullable: true })
	taskId?: ITask['id'];
}
