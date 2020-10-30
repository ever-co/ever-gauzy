import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { OrganizationContact } from './organization-contact.entity';

@Injectable()
export class OrganizationContactService extends TenantAwareCrudService<
	OrganizationContact
> {
	constructor(
		@InjectRepository(OrganizationContact)
		private readonly organizationContactRepository: Repository<
			OrganizationContact
		>
	) {
		super(organizationContactRepository);
	}

	async findByEmployee(id: string, data: any): Promise<any> {
		const { findInput = null } = data;
		const query = this.organizationContactRepository
			.createQueryBuilder('organization_contact')
			.leftJoin('organization_contact.members', 'member')
			.where('member.id = :id', { id });

		if (findInput) {
			const { organizationId, tenantId } = findInput;
			query
				.andWhere(`${query.alias}.organizationId = :organizationId`, {
					organizationId
				})
				.andWhere(`${query.alias}.tenantId = :tenantId`, {
					tenantId
				});
		}
		return await query.getMany();
	}
}
