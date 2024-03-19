import { EntityRepository } from '@mikro-orm/knex';
import { IntegrationMap } from '../integration-map.entity';

export class MikroOrmIntegrationMapRepository extends EntityRepository<IntegrationMap> { }
