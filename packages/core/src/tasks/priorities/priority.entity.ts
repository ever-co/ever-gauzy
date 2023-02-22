import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { IOrganizationProject, IOrganizationTeam, ITaskPriority } from '@gauzy/contracts';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	OrganizationProject,
	OrganizationTeam,
	TaskStatus,
	TenantOrganizationBaseEntity,
} from './../../core/entities/internal';

@Entity('task_priority')
export class TaskPriority extends TenantOrganizationBaseEntity implements ITaskPriority {

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

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Organization Project
	 */
	@ManyToOne(() => OrganizationProject, (project) => project.priorities, {
		onDelete: 'SET NULL',
	})
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TaskPriority) => it.project)
	@Index()
	@Column({ nullable: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * Organization Team
	 */
	@ManyToOne(() => OrganizationTeam, (team) => team.priorities, {
		onDelete: 'SET NULL',
	})
	team?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TaskStatus) => it.team)
	@Index()
	@Column({ nullable: true })
	teamId?: IOrganizationTeam['id'];
}
