import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationAward } from './organization-award.entity';
import { MikroOrmOrganizationAwardRepository } from './repository/mikro-orm-organization-award.repository';
import { TypeOrmOrganizationAwardRepository } from './repository/type-orm-organization-award.repository';

@Injectable()
export class OrganizationAwardService extends TenantAwareCrudService<OrganizationAward> {
	constructor(
		@InjectRepository(OrganizationAward)
		typeOrmOrganizationAwardRepository: TypeOrmOrganizationAwardRepository,

		mikroOrmOrganizationAwardRepository: MikroOrmOrganizationAwardRepository
	) {
		super(typeOrmOrganizationAwardRepository, mikroOrmOrganizationAwardRepository);
	}
}
