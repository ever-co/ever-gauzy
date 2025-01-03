import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from '../core/crud';
import { TagType } from './tag-type.entity';
import { MikroOrmTagTypeRepository } from './repository/mikro-orm-tag-type.repository';
import { TypeOrmTagTypeRepository } from './repository/type-orm-tag-type.repository';

@Injectable()
export class TagTypeService extends TenantAwareCrudService<TagType> {
	constructor(
		@InjectRepository(TagType)
		typeOrmProductTypeRepository: TypeOrmTagTypeRepository,

		mikroOrmProductTypeRepository: MikroOrmTagTypeRepository
	) {
		super(typeOrmProductTypeRepository, mikroOrmProductTypeRepository);
	}
}
