import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Contact } from './contact.entity';

@Injectable()
export class ContactService extends CrudService<Contact> {
	constructor(
		@InjectRepository(Contact)
		private readonly contactRepository: Repository<Contact>
	) {
		super(contactRepository);
	}
}
