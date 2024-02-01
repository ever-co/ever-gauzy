import { Repository } from 'typeorm';
import { Organization } from '../organization.entity';

export class TypeOrmOrganizationRepository extends Repository<Organization> { }