import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationPosition } from './organization-position.entity';
import { TypeOrmOrganizationPositionRepository } from './repository/type-orm-organization-position.repository';
import { MikroOrmOrganizationPositionRepository } from './repository/mikro-orm-organization-position.repository';

@Injectable()
export class OrganizationPositionService extends TenantAwareCrudService<OrganizationPosition> {
	constructor(
		typeOrmOrganizationPositionRepository: TypeOrmOrganizationPositionRepository,
		mikroOrmOrganizationPositionRepository: MikroOrmOrganizationPositionRepository
	) {
		super(typeOrmOrganizationPositionRepository, mikroOrmOrganizationPositionRepository);
	}
}
