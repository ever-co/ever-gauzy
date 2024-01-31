import { EntityRepository } from '@mikro-orm/core';
import { FeatureOrganization } from '../feature-organization.entity';

export class MikroOrmFeatureOrganizationRepository extends EntityRepository<FeatureOrganization> { }
