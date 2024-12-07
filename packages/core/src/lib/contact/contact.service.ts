import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmContactRepository } from './repository/type-orm-contact.repository';
import { MikroOrmContactRepository } from './repository/mikro-orm-contact.repository';
import { Contact } from './contact.entity';

@Injectable()
export class ContactService extends TenantAwareCrudService<Contact> {
	constructor(
		readonly typeOrmContactRepository: TypeOrmContactRepository,
		readonly mikroOrmContactRepository: MikroOrmContactRepository
	) {
		super(typeOrmContactRepository, mikroOrmContactRepository);
	}
}
