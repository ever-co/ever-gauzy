import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from '../core/crud';
import { Integration } from './integration.entity';
import { TypeOrmIntegrationRepository } from './repository/type-orm-integration.repository';
import { MikroOrmIntegrationRepository } from './repository/mikro-orm-integration.repository';

@Injectable()
export class IntegrationService extends CrudService<Integration> {

	constructor(
		@InjectRepository(Integration)
		typeOrmIntegrationRepository: TypeOrmIntegrationRepository,

		mikroOrmIntegrationRepository: MikroOrmIntegrationRepository
	) {
		super(typeOrmIntegrationRepository, mikroOrmIntegrationRepository);
	}
}
