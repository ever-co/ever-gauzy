import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '../core/crud';
import { TagType } from './tag-type.entity';
import { MikroOrmTagTypeRepository } from './repository/mikro-orm-tag-type.repository';
import { TypeOrmTagTypeRepository } from './repository/type-orm-tag-type.repository';

@Injectable()
export class TagTypeService extends TenantAwareCrudService<TagType> {
	constructor(
		typeOrmTagTypeRepository: TypeOrmTagTypeRepository,
		mikroOrmTagTypeRepository: MikroOrmTagTypeRepository
	) {
		super(typeOrmTagTypeRepository, mikroOrmTagTypeRepository);
	}
}
