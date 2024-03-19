import { EntityRepository } from '@mikro-orm/knex';
import { Contact } from '../contact.entity';

export class MikroOrmContactRepository extends EntityRepository<Contact> { }
