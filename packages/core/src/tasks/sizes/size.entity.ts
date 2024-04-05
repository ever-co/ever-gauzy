import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IOrganizationProject, IOrganizationTeam, ITaskSize } from '@gauzy/contracts';
import {
	OrganizationProject,
	OrganizationTeam,
	TenantOrganizationBaseEntity,
} from './../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, VirtualMultiOrmColumn } from './../../core/decorators/entity';
import { MikroOrmTaskSizeRepository } from './repository/mikro-orm-task-size.repository';

@MultiORMEntity('task_size', { mikroOrmRepository: () => MikroOrmTaskSizeRepository })
export class TaskSize extends TenantOrganizationBaseEntity implements ITaskSize {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn()
	value: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	description?: string;

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

	/** Additional virtual columns */
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
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.sizes, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TaskSize) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * Organization Team Relationship
	 */
	@MultiORMManyToOne(() => OrganizationTeam, (it) => it.sizes, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	organizationTeam?: IOrganizationTeam;

	/**
	 * Organization Team ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TaskSize) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationTeamId?: IOrganizationTeam['id'];
}
