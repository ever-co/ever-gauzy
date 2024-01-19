import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { Contact } from './contact.entity';
import { IContactCreateInput } from '@gauzy/contracts';

@Injectable()
export class ContactService extends TenantAwareCrudService<Contact> {
	constructor(
		@InjectRepository(Contact)
		private readonly contactRepository: Repository<Contact>,
		@MikroInjectRepository(Contact)
		private readonly mikroContactRepository: EntityRepository<Contact>
	) {
		super(contactRepository, mikroContactRepository);
	}

	async saveContact(contactRequest: IContactCreateInput): Promise<Contact> {
		return this.contactRepository.save(contactRequest);
	}
}
