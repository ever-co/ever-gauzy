import { JoinColumn, RelationId } from 'typeorm';
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
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';
import { MikroOrmActivityRepository } from './repository/mikro-orm-activity.repository';

@MultiORMEntity('activity', { mikroOrmRepository: () => MikroOrmActivityRepository })
export class Activity extends TenantOrganizationBaseEntity implements IActivity {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
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
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'date', nullable: true })
	date: string;

	@ApiProperty({ type: () => 'time' })
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'time', nullable: true })
	time: string;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	duration?: number;

	@ApiPropertyOptional({ type: () => String, enum: ActivityType })
	@IsOptional()
	@IsEnum(ActivityType)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	type?: string;

	@ApiPropertyOptional({ type: () => String, enum: TimeLogSourceEnum, default: TimeLogSourceEnum.WEB_TIMER })
	@IsOptional()
	@IsEnum(TimeLogSourceEnum)
	@ColumnIndex()
	@MultiORMColumn({ default: TimeLogSourceEnum.WEB_TIMER })
	source?: string;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	recordedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, {
		nullable: false,
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
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
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
	@ColumnIndex()
	@RelationId((it: Activity) => it.project)
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * Time Slot Activity
	 */
	@MultiORMManyToOne(() => TimeSlot, (it) => it.activities, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timeSlot?: ITimeSlot;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@RelationId((it: Activity) => it.timeSlot)
	@MultiORMColumn({ nullable: true, relationId: true })
	timeSlotId?: ITimeSlot['id'];

	/**
	 * Task Activity
	 */
	@MultiORMManyToOne(() => Task, (it) => it.activities, {
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
	@ColumnIndex()
	@RelationId((it: Activity) => it.task)
	@MultiORMColumn({ nullable: true, relationId: true })
	taskId?: ITask['id'];
}
