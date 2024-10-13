import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';
import { EntityEnum, ID, IResourceLink, IURLMetaData, IUser } from '@gauzy/contracts';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmResourceLinkRepository } from './repository/mikro-orm-resource-link.repository';

@MultiORMEntity('resource_links', { mikroOrmRepository: () => MikroOrmResourceLinkRepository })
export class ResourceLink extends TenantOrganizationBaseEntity implements IResourceLink {
	[EntityRepositoryType]?: MikroOrmResourceLinkRepository;

	@ApiProperty({ type: () => String, enum: EntityEnum })
	@IsNotEmpty()
	@IsEnum(EntityEnum)
	@ColumnIndex()
	@MultiORMColumn()
	entity: EntityEnum;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	entityId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	title: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUrl()
	@MultiORMColumn({ type: 'text' })
	url: string;

	@ApiPropertyOptional({
		type: () => (isSqlite() || isBetterSqlite3() ? String : Object)
	})
	@IsOptional()
	@MultiORMColumn({
		nullable: true,
		type: isSqlite() || isBetterSqlite3() ? 'text' : 'json'
	})
	metaData?: string | IURLMetaData;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * User comment author
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	creator?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: ResourceLink) => it.creator)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	creatorId?: string;
}
