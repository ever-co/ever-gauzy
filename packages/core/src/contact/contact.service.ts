import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IContactCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmContactRepository } from './repository/type-orm-contact.repository';
import { MikroOrmContactRepository } from './repository/mikro-orm-contact.repository';
import { Contact } from './contact.entity';

@Injectable()
export class ContactService extends TenantAwareCrudService<Contact> {
	constructor(
		@InjectRepository(Contact)
		typeOrmContactRepository: TypeOrmContactRepository,

		mikroOrmContactRepository: MikroOrmContactRepository
	) {
		super(typeOrmContactRepository, mikroOrmContactRepository);
	}

	async saveContact(contactRequest: IContactCreateInput): Promise<Contact> {
		return this.repository.save(contactRequest);
	}
}
