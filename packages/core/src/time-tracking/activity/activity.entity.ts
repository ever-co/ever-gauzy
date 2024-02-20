import { Column, RelationId, ManyToOne, JoinColumn, Index } from 'typeorm';
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
import { MikroOrmActivityRepository } from './repository/mikro-orm-activity.repository';

@MultiORMEntity('activity', { mikroOrmRepository: () => MikroOrmActivityRepository })
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
		type: isSqlite() || isBetterSqlite3() ? 'text' : 'json',
		nullable: true
	})
	metaData?: string | IURLMetaData;

	@ApiProperty({ type: () => 'date' })
	@IsString()
	@Index()
	@Column({ type: 'date', nullable: true })
	date: string;

	@ApiProperty({ type: () => 'time' })
	@IsString()
	@Index()
	@Column({ type: 'time', nullable: true })
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

	@ApiPropertyOptional({ type: () => String, enum: TimeLogSourceEnum, default: TimeLogSourceEnum.WEB_TIMER })
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
	 * Employee
	 */
	@ManyToOne(() => Employee, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: false,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	/**
	 * Employee ID
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Activity) => it.employee)
	@Index()
	@Column()
	employeeId?: IEmployee['id'];

	/**
	 * Organization Project Relationship
	 */
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
	@Index()
	@RelationId((it: Activity) => it.project)
	@Column({ nullable: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * Time Slot Activity
	 */
	@ManyToOne(() => TimeSlot, (it) => it.activities, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timeSlot?: ITimeSlot;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@Index()
	@RelationId((it: Activity) => it.timeSlot)
	@Column({ nullable: true })
	timeSlotId?: ITimeSlot['id'];

	/**
	 * Task Activity
	 */
	@ManyToOne(() => Task, (it) => it.activities, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	task?: ITask;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@Index()
	@RelationId((it: Activity) => it.task)
	@Column({ nullable: true })
	taskId?: ITask['id'];
}
