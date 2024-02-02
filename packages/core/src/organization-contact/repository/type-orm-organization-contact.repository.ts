import { Repository } from 'typeorm';
import { OrganizationContact } from '../organization-contact.entity';

export class TypeOrmOrganizationContactRepository extends Repository<OrganizationContact> { }