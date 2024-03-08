import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	Index,
	JoinColumn,
	RelationId,
} from 'typeorm';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	IImageAsset,
	IIssueType,
	IOrganizationProject,
	IOrganizationTeam,
} from '@gauzy/contracts';
import {
	ImageAsset,
	OrganizationProject,
	OrganizationTeam,
	TenantOrganizationBaseEntity,
} from './../../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../../core/decorators/entity';
import { MikroOrmIssueTypeRepository } from './repository/mikro-orm-issue-type.repository';
import { MultiORMManyToOne } from '../../core/decorators/entity/relations';

@MultiORMEntity('issue_type', { mikroOrmRepository: () => MikroOrmIssueTypeRepository })
export class IssueType extends TenantOrganizationBaseEntity implements IIssueType {

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
	 * Image Asset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,
	})
	@JoinColumn()
	image?: IImageAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: IssueType) => it.image)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: IImageAsset['id'];

	/**
	 * Organization Project
	 */
	@MultiORMManyToOne(() => OrganizationProject, {
		onDelete: 'CASCADE',
	})
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: IssueType) => it.project)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * Organization Team
	 */
	@MultiORMManyToOne(() => OrganizationTeam, {
		onDelete: 'CASCADE',
	})
	organizationTeam?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: IssueType) => it.organizationTeam)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationTeamId?: IOrganizationTeam['id'];
}
