import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId } from 'typeorm';
import { EntityRepositoryType } from '@mikro-orm/knex';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IOrganizationProject, IOrganizationTeam, ITaskStatus, TaskStatusEnum } from '@gauzy/contracts';
import { OrganizationProject, OrganizationTeam, TenantOrganizationBaseEntity } from '../../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	VirtualMultiOrmColumn
} from '../../core/decorators/entity';
import { MikroOrmTaskStatusRepository } from './repository';

@MultiORMEntity('task_status', { mikroOrmRepository: () => MikroOrmTaskStatusRepository })
export class TaskStatus extends TenantOrganizationBaseEntity implements ITaskStatus {
	[EntityRepositoryType]?: MikroOrmTaskStatusRepository;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	value: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	order?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	icon?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	color?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@MultiORMColumn({ default: false, update: false })
	isSystem?: boolean;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isCollapsed?: boolean;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isDefault?: boolean;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isTodo?: boolean;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isInProgress?: boolean;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isDone?: boolean;

	/** Additional virtual columns */
	@ApiPropertyOptional({ type: () => String, enum: TaskStatusEnum })
	@IsOptional()
	@IsEnum(TaskStatusEnum)
	@VirtualMultiOrmColumn()
	template?: TaskStatusEnum;

	@VirtualMultiOrmColumn()
	fullIconUrl?: string;
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Organization Project Relationship
	 */
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.statuses, {
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
	@RelationId((it: TaskStatus) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: ID;

	/**
	 * Organization Team
	 */
	@MultiORMManyToOne(() => OrganizationTeam, (it) => it.statuses, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationTeam?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TaskStatus) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationTeamId?: ID;
}
