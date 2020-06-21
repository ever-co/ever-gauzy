import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Contacts } from './contacts.entity';

@Injectable()
export class ContactsService extends CrudService<Contacts> {
	constructor(
		@InjectRepository(Contacts)
		private readonly contactsRepository: Repository<Contacts>
	) {
		super(contactsRepository);
	}

	async findByEmployee(id: string): Promise<any> {
		return await this.contactsRepository
			.createQueryBuilder('contact')
			// .leftJoin('organization_client.members', 'member')
			// .where('member.id = :id', { id })
			.getMany();
	}
}
