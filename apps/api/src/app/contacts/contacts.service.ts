import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { Contacts } from './contacts.entity';
import { ContactsCreateInput } from '@gauzy/models';

@Injectable()
export class ContactsService extends CrudService<Contacts> {
	constructor(
		@InjectRepository(Contacts)
		private readonly contactsRepository: Repository<Contacts>
	) {
		super(contactsRepository);
	}

	async saveContacts(
		contactsRequest: ContactsCreateInput
	): Promise<Contacts> {
		// const contact = new Contacts();
		// contact.name = 'Joe Smith';
		// contact.profile = profile;
		// await connection.manager.save(user);
		return this.contactsRepository.save(
			contactsRequest
		);
	}

	

	// async findAllContact(): Promise<any> {
	// 	return await this.contactsRepository
	// 		.createQueryBuilder('contact')
	// 		// .getMany();
	// }
}
