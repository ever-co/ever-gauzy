import { ApiProperty } from '@nestjs/swagger';
import { Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmTagTypeRepository } from './repository/mikro-orm-tag-type.repository';
import { ITagType } from '@gauzy/contracts';

@MultiORMEntity('tag_type', { mikroOrmRepository: () => MikroOrmTagTypeRepository })
export class TagType extends TenantOrganizationBaseEntity implements ITagType {
	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	type: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * tags
	 */
	@ApiProperty({ type: () => Tag, isArray: true })
	@MultiORMOneToMany(() => Tag, (tag) => tag.tagType)
	tags?: Tag[];
}
