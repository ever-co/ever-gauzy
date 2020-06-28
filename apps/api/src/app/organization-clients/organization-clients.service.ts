import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationClients } from './organization-clients.entity';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class OrganizationClientsService extends TenantAwareCrudService<
	OrganizationClients
> {
	constructor(
		@InjectRepository(OrganizationClients)
		private readonly organizationClientsRepository: Repository<
			OrganizationClients
		>
	) {
		super(organizationClientsRepository);
	}

	async findByEmployee(id: string): Promise<any> {
		return await this.organizationClientsRepository
			.createQueryBuilder('organization_client')
			.leftJoin('organization_client.members', 'member')
			.where('member.id = :id', { id })
			.getMany();
	}
}
