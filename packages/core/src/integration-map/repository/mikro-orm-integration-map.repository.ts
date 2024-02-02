import { EntityRepository } from '@mikro-orm/core';
import { IntegrationMap } from '../integration-map.entity';

export class MikroOrmIntegrationMapRepository extends EntityRepository<IntegrationMap> { }