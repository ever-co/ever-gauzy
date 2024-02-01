import { Repository } from 'typeorm';
import { Tenant } from '../tenant.entity';

export class TypeOrmTenantRepository extends Repository<Tenant> { }