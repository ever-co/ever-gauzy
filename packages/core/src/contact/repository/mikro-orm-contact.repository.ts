import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Contact } from '../contact.entity';

export class MikroOrmContactRepository extends MikroOrmBaseEntityRepository<Contact> { }
