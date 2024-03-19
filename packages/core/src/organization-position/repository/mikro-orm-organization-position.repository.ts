import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationPosition } from '../organization-position.entity';

export class MikroOrmOrganizationPositionRepository extends EntityRepository<OrganizationPosition> { }
