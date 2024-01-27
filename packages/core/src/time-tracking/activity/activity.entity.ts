import { Column, RelationId, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import {
	IActivity,
	ActivityType,
	TimeLogSourceEnum,
	IURLMetaData,
	IEmployee,
	ITask,
	ITimeSlot,
	IOrganizationProject,
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsNumber, IsDateString, IsUUID } from 'class-validator';
import { isBetterSqlite3, isMySQL, isSqlite } from '@gauzy/config';
import {
	Employee,
	OrganizationProject,
	Task,
	TenantOrganizationBaseEntity,
	TimeSlot
} from './../../core/entities/internal';
import { MultiORMEntity } from '../../core/decorators/entity';

@MultiORMEntity('activity')
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
	@Column({
		nullable: true,
		...(isMySQL() ? { type: 'longtext' } : {})
	})
	description?: string;

	@ApiPropertyOptional({
		type: () => (isSqlite() || isBetterSqlite3() ? 'text' : 'json')
	})
	@IsOptional()
	@IsString()
	@Column({
		nullable: true,
		type: isSqlite() || isBetterSqlite3() ? 'text' : 'json'
	})
	metaData?: string | IURLMetaData;

	@ApiProperty({ type: () => 'date' })
	@IsDateString()
	@Index()
	@CreateDateColumn(isMySQL() ? { type: 'datetime' } : { type: 'date' })
	date: string;

	@ApiProperty({ type: () => 'time' })
	@IsDateString()
	@Index()
	@CreateDateColumn({ type: 'time', default: '0' })
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
	 * Organization Project Relationship
	 */
	@ApiProperty({ type: () => OrganizationProject })
	@ManyToOne(() => OrganizationProject, (it) => it.activities, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	project?: IOrganizationProject;

	/**
	 * Organization Project ID
	 */
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
