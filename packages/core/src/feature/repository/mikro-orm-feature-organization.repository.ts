import { EntityRepository } from '@mikro-orm/knex';
import { FeatureOrganization } from '../feature-organization.entity';

export class MikroOrmFeatureOrganizationRepository extends EntityRepository<FeatureOrganization> { }
