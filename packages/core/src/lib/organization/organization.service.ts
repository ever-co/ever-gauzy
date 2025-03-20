import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { Organization } from './organization.entity';
import { TypeOrmOrganizationRepository, MikroOrmOrganizationRepository } from './repository';
import { prepareSQLQuery as p } from './../database/database.helper';

@Injectable()
export class OrganizationService extends TenantAwareCrudService<Organization> {
	constructor(
		readonly typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		readonly mikroOrmOrganizationRepository: MikroOrmOrganizationRepository
	) {
		super(typeOrmOrganizationRepository, mikroOrmOrganizationRepository);
	}

	async findByEmailDomain(emailDomain: string): Promise<Organization> {
		const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
		query.setFindOptions({
			select: {
				id: true,
				tenantId: true
			},
		});
		query.where(p(`"${query.alias}"."emailDomain" = :emailDomain`), { emailDomain });
		return await query.getOne();
	}
}
