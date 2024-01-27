import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Index, ManyToOne, RelationId } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IOrganizationProject, IOrganizationTeam, ITaskSize } from '@gauzy/contracts';
import {
	OrganizationProject,
	OrganizationTeam,
	TenantOrganizationBaseEntity,
} from './../../core/entities/internal';
import { MultiORMEntity } from './../../core/decorators/entity';

@MultiORMEntity('task_size')
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
	@ManyToOne(() => OrganizationProject, (it) => it.sizes, {
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
	@ManyToOne(() => OrganizationTeam, (it) => it.sizes, {
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
