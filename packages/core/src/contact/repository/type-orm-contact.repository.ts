import { Repository } from 'typeorm';
import { Contact } from '../contact.entity';

export class TypeOrmContactRepository extends Repository<Contact> { }