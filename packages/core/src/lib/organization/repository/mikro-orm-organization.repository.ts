import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Organization } from '../organization.entity';

export class MikroOrmOrganizationRepository extends MikroOrmBaseEntityRepository<Organization> { }
