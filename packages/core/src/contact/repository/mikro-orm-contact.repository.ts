import { EntityRepository } from '@mikro-orm/core';
import { Contact } from '../contact.entity';

export class MikroOrmContactRepository extends EntityRepository<Contact> { }