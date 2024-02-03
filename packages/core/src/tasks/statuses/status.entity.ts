import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Index, RelationId } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IOrganizationProject, IOrganizationTeam, ITaskStatus } from '@gauzy/contracts';
import {
	OrganizationProject,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from '../../core/entities/internal';
import { MultiORMEntity } from '../../core/decorators/entity';
import { MikroOrmTaskStatusRepository } from './repository/mikro-orm-task-status.repository';
import { MultiORMManyToOne } from '../../core/decorators/entity/relations';

@MultiORMEntity('task_status', { mikroOrmRepository: () => MikroOrmTaskStatusRepository })
export class TaskStatus extends TenantOrganizationBaseEntity implements ITaskStatus {

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

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@Column({ nullable: true })
	order?: number;

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

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@Column({ default: false })
	isCollapsed?: boolean;

	/**
	 * Additional Property
	 */
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
		onDelete: 'CASCADE',
	})
	project?: IOrganizationProject;

	/**
	 * Organization Project ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TaskStatus) => it.project)
	@Index()
	@Column({ nullable: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * Organization Team
	 */
	@MultiORMManyToOne(() => OrganizationTeam, (it) => it.statuses, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	organizationTeam?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TaskStatus) => it.organizationTeam)
	@Index()
	@Column({ nullable: true })
	organizationTeamId?: IOrganizationTeam['id'];
}
