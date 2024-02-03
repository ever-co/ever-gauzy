import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Index, RelationId } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IOrganizationProject, IOrganizationTeam, ITaskSize } from '@gauzy/contracts';
import {
	OrganizationProject,
	OrganizationTeam,
	TenantOrganizationBaseEntity,
} from './../../core/entities/internal';
import { MultiORMEntity } from './../../core/decorators/entity';
import { MikroOrmTaskSizeRepository } from './repository/mikro-orm-task-size.repository';
import { MultiORMManyToOne } from '../../core/decorators/entity/relations';

@MultiORMEntity('task_size', { mikroOrmRepository: () => MikroOrmTaskSizeRepository })
export class TaskSize extends TenantOrganizationBaseEntity implements ITaskSize {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	value: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	icon?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	color?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@Column({ default: false, update: false })
	isSystem?: boolean;

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
	@Index()
	@Column({ nullable: true })
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
	@Index()
	@Column({ nullable: true })
	organizationTeamId?: IOrganizationTeam['id'];
}
