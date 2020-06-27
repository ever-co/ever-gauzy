import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { Contact } from './contact.entity';
import { ContactCreateInput } from '@gauzy/models';

@Injectable()
export class ContactService extends CrudService<Contact> {
	constructor(
		@InjectRepository(Contact)
		private readonly contactsRepository: Repository<Contact>
	) {
		super(contactsRepository);
	}

	async saveContacts(
		contactRequest: ContactCreateInput
	): Promise<Contact> {
		return this.contactsRepository.save(contactRequest);
	}

}
