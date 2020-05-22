import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationContacts } from './organization-contacts.entity';

@Injectable()
export class OrganizationContactsService extends CrudService<
	OrganizationContacts
> {
	constructor(
		@InjectRepository(OrganizationContacts)
		private readonly organizationContactsRepository: Repository<
			OrganizationContacts
		>
	) {
		super(organizationContactsRepository);
	}

	async findByEmployee(id: string): Promise<any> {
		return await this.organizationContactsRepository
			.createQueryBuilder('organization_contact')
			.leftJoin('organization_contact.members', 'member')
			.where('member.id = :id', { id })
			.getMany();
	}
}
