import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ITag, ITagType } from '@gauzy/contracts';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmTagTypeRepository } from './repository/mikro-orm-tag-type.repository';
import { Taggable } from '../tags/tag.types';

@MultiORMEntity('tag_type', { mikroOrmRepository: () => MikroOrmTagTypeRepository })
export class TagType extends TenantOrganizationBaseEntity implements ITagType, Taggable {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	type: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * A collection of tags associated with the tag type.
	 */
	@ApiPropertyOptional({ type: () => [Tag], isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => Tag, (tag) => tag.tagType)
	tags?: ITag[];
}
