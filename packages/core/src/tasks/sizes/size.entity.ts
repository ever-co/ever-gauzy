import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IOrganizationProject, ITaskSize } from '@gauzy/contracts';
import {
	OrganizationProject,
	TenantOrganizationBaseEntity,
} from './../../core/entities/internal';

@Entity('task_size')
export class TaskSize
	extends TenantOrganizationBaseEntity
	implements ITaskSize
{
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
	@ManyToOne(() => OrganizationProject, (project) => project.sizes, {
		onDelete: 'SET NULL',
	})
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TaskSize) => it.project)
	@Index()
	@Column({ nullable: true })
	projectId?: IOrganizationProject['id'];
}
