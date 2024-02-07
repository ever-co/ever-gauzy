import { RelationId, JoinColumn, CreateDateColumn, Index } from 'typeorm';
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
import { MultiORMColumn, MultiORMEntity } from '../../core/decorators/entity';
import { MikroOrmActivityRepository } from './repository/mikro-orm-activity.repository';
import { MultiORMManyToOne } from '../../core/decorators/entity/relations';

@MultiORMEntity('activity', { mikroOrmRepository: () => MikroOrmActivityRepository })
export class Activity extends TenantOrganizationBaseEntity implements IActivity {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@MultiORMColumn({ nullable: true })
	title: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({
		nullable: true,
		...(isMySQL() ? { type: 'longtext' } : {})
	})
	description?: string;

	@ApiPropertyOptional({
		type: () => (isSqlite() || isBetterSqlite3() ? 'text' : 'json')
	})
	@IsOptional()
	@IsString()
	@MultiORMColumn({
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
	@MultiORMColumn({ default: 0 })
	duration?: number;

	@ApiPropertyOptional({ type: () => String, enum: ActivityType })
	@IsOptional()
	@IsEnum(ActivityType)
	@Index()
	@MultiORMColumn({ nullable: true })
	type?: string;

	@ApiPropertyOptional({
		type: () => String,
		enum: TimeLogSourceEnum,
		default: TimeLogSourceEnum.WEB_TIMER
	})
	@IsOptional()
	@IsEnum(TimeLogSourceEnum)
	@Index()
	@MultiORMColumn({ default: TimeLogSourceEnum.WEB_TIMER })
	source?: string;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Index()
	@MultiORMColumn({ nullable: true })
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
	@MultiORMManyToOne(() => Employee, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Activity) => it.employee)
	@Index()
	@MultiORMColumn({ nullable: false, relationId: true })
	employeeId?: IEmployee['id'];

	/**
	 * Organization Project Relationship
	 */
	@ApiProperty({ type: () => OrganizationProject })
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.activities, {
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
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * Time Slot Activity
	 */
	@ApiProperty({ type: () => TimeSlot })
	@MultiORMManyToOne(() => TimeSlot, (timeSlot) => timeSlot.activities, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timeSlot?: ITimeSlot;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Activity) => it.timeSlot)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	timeSlotId?: ITimeSlot['id'];

	/**
	 * Task Activity
	 */
	@ApiPropertyOptional({ type: () => Task })
	@IsOptional()
	@MultiORMManyToOne(() => Task, (task) => task.activities, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	task?: ITask;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Activity) => it.task)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	taskId?: ITask['id'];
}
