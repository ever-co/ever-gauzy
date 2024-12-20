import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { KeyResultTemplate } from './keyresult-template.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { MikroOrmKeyResultTemplateRepository } from './repository/mikro-orm-keyresult-template.repository';
import { TypeOrmKeyResultTemplateRepository } from './repository/type-orm-keyresult-template.repository';

@Injectable()
export class KeyresultTemplateService extends TenantAwareCrudService<KeyResultTemplate> {
	constructor(
		@InjectRepository(KeyResultTemplate)
		typeOrmKeyResultTemplateRepository: TypeOrmKeyResultTemplateRepository,

		mikroOrmKeyResultTemplateRepository: MikroOrmKeyResultTemplateRepository
	) {
		super(typeOrmKeyResultTemplateRepository, mikroOrmKeyResultTemplateRepository);
	}
}
