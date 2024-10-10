import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IImageAsset, IIssueType, IOrganizationProject, IOrganizationTeam, TaskTypeEnum } from '@gauzy/contracts';
import {
	ImageAsset,
	OrganizationProject,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from './../../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	VirtualMultiOrmColumn
} from './../../core/decorators/entity';
import { MikroOrmIssueTypeRepository } from './repository/mikro-orm-issue-type.repository';

@MultiORMEntity('issue_type', { mikroOrmRepository: () => MikroOrmIssueTypeRepository })
export class IssueType extends TenantOrganizationBaseEntity implements IIssueType {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String, enum: TaskTypeEnum })
	@IsEnum(TaskTypeEnum)
	@ColumnIndex()
	@MultiORMColumn()
	value: TaskTypeEnum;

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
	@IsOptional()
	@MultiORMColumn({ default: false })
	isDefault?: boolean;

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
	 * Image Asset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
	})
	@JoinColumn()
	image?: IImageAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: IssueType) => it.image)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: ID;

	/**
	 * Organization Project
	 */
	@MultiORMManyToOne(() => OrganizationProject, {
		onDelete: 'CASCADE'
	})
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: IssueType) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: ID;

	/**
	 * Organization Team
	 */
	@MultiORMManyToOne(() => OrganizationTeam, {
		onDelete: 'CASCADE'
	})
	organizationTeam?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: IssueType) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationTeamId?: ID;
}
