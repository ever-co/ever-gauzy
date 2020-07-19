import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationContact } from './organization-contact.entity';

@Injectable()
export class OrganizationContactService extends CrudService<
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

	async findByEmployee(id: string): Promise<any> {
		return await this.organizationContactRepository
			.createQueryBuilder('organization_contact')
			.leftJoin('organization_contact.members', 'member')
			.where('member.id = :id', { id })
			.getMany();
	}
}
