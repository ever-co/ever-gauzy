import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId } from 'typeorm';
import {
	ID,
	IOrganizationProject,
	IOrganizationProjectModule,
	IOrganizationSprint,
	IOrganizationTeam,
	ITaskView,
	JsonData,
	TaskViewVisibilityEnum,
	VisibilityLevelEnum
} from '@gauzy/contracts';
import { isMySQL, isPostgres } from '@gauzy/config';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import {
	OrganizationProject,
	OrganizationProjectModule,
	OrganizationSprint,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from '../../core/entities/internal';
import { ColumnIndex, JsonArrayColumn, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';
import { MikroOrmTaskViewRepository } from './repository/mikro-orm-task-view.repository';

@MultiORMEntity('task_view', { mikroOrmRepository: () => MikroOrmTaskViewRepository })
export class TaskView extends TenantOrganizationBaseEntity implements ITaskView {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	description?: string;

	@ApiPropertyOptional({ type: () => String, enum: VisibilityLevelEnum })
	@IsOptional()
	@IsEnum(VisibilityLevelEnum)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	visibilityLevel?: VisibilityLevelEnum;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	queryParams?: JsonData;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	filterOptions?: JsonData;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	displayOptions?: JsonData;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	properties?: Record<string, boolean>;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false, update: false })
	isLocked?: boolean;

	/** Personal views are listed to their creator only; null means shared (every view saved before the column). */
	@ApiPropertyOptional({ type: () => String, enum: TaskViewVisibilityEnum })
	@IsOptional()
	@IsEnum(TaskViewVisibilityEnum)
	@MultiORMColumn({ nullable: true, length: 16 })
	visibility?: TaskViewVisibilityEnum;

	/** Bumped by every save; an update that states the version it read is refused when the view moved on. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(1)
	@MultiORMColumn({ default: 1 })
	version?: number;

	/** The task ids in the order the view shows them when its ordering is manual. */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@JsonArrayColumn<ID>({ nullable: true })
	manualOrder?: ID[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Organization Project Relationship
	 */
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.views, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	project?: IOrganizationProject;

	/**
	 * Organization Project ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TaskView) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: ID;

	/**
	 * Organization Team Relationship
	 */
	@MultiORMManyToOne(() => OrganizationTeam, (it) => it.views, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationTeam?: IOrganizationTeam;

	/**
	 * Organization Team ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TaskView) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationTeamId?: ID;

	/**
	 * Organization Project Module Relationship
	 */
	@MultiORMManyToOne(() => OrganizationProjectModule, (it) => it.views, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	projectModule?: IOrganizationProjectModule;

	/**
	 * Organization Project Module ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TaskView) => it.projectModule)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectModuleId?: ID;

	/**
	 * Organization Sprint Relationship
	 */
	@MultiORMManyToOne(() => OrganizationSprint, (it) => it.views, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationSprint?: IOrganizationSprint;

	/**
	 * Organization Sprint ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TaskView) => it.organizationSprint)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationSprintId?: ID;
}
