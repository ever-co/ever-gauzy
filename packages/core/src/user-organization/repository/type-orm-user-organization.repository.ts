import { Repository } from 'typeorm';
import { UserOrganization } from '../user-organization.entity';

export class TypeOrmUserOrganizationRepository extends Repository<UserOrganization> { }