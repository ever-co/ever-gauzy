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
		return this.contactsRepository.save(contactsRequest);
	}

}
