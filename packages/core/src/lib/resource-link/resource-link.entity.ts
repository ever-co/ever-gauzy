import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { ID, IResourceLink, IURLMetaData, IUser } from '@gauzy/contracts';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BasePerEntityType, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmResourceLinkRepository } from './repository/mikro-orm-resource-link.repository';

@MultiORMEntity('resource_link', { mikroOrmRepository: () => MikroOrmResourceLinkRepository })
export class ResourceLink extends BasePerEntityType implements IResourceLink {
	[EntityRepositoryType]?: MikroOrmResourceLinkRepository;

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

	@ApiPropertyOptional({ type: () => (isSqlite() || isBetterSqlite3() ? String : Object) })
	@IsOptional()
	@MultiORMColumn({ nullable: true, type: isSqlite() || isBetterSqlite3() ? 'text' : 'json' })
	metaData?: string | IURLMetaData;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * User Author of the Resource Link
	 */
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	creator?: IUser;

	@RelationId((it: ResourceLink) => it.creator)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	creatorId?: ID;
}
