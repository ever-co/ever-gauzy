import { Injectable } from '@nestjs/common';
import { BaseEntityEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmContactRepository } from './repository/type-orm-contact.repository';
import { MikroOrmContactRepository } from './repository/mikro-orm-contact.repository';
import { Contact } from './contact.entity';
import { FavoriteService } from '../core/decorators';

@FavoriteService(BaseEntityEnum.Contact)
@Injectable()
export class ContactService extends TenantAwareCrudService<Contact> {
	constructor(
		readonly typeOrmContactRepository: TypeOrmContactRepository,
		readonly mikroOrmContactRepository: MikroOrmContactRepository
	) {
		super(typeOrmContactRepository, mikroOrmContactRepository);
	}
}
