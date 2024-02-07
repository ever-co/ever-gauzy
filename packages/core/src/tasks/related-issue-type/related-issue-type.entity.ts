import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Index, RelationId } from 'typeorm';
import {
	IOrganizationProject,
	IOrganizationTeam,
	ITaskRelatedIssueType,
} from '@gauzy/contracts';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	OrganizationProject,
	OrganizationTeam,
	TenantOrganizationBaseEntity,
} from '../../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../../core/decorators/entity';
import { MikroOrmTaskRelatedIssueTypeRepository } from './repository/mikro-orm-related-issue-type.repository';
import { MultiORMManyToOne } from '../../core/decorators/entity/relations';

@MultiORMEntity('task_related_issue_type', { mikroOrmRepository: () => MikroOrmTaskRelatedIssueTypeRepository })
export class TaskRelatedIssueType extends TenantOrganizationBaseEntity implements ITaskRelatedIssueType {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Index()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@Index()
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

	fullIconUrl?: string;
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Organization Project Relationship
	 */
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.relatedIssueTypes, {
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
	@RelationId((it: TaskRelatedIssueType) => it.project)
	@Index()
	@MultiORMColumn({ nullable: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * Organization Team Relationship
	 */
	@MultiORMManyToOne(() => OrganizationTeam, (it) => it.relatedIssueTypes, {
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
	@RelationId((it: TaskRelatedIssueType) => it.organizationTeam)
	@Index()
	@MultiORMColumn({ nullable: true })
	organizationTeamId?: IOrganizationTeam['id'];
}
