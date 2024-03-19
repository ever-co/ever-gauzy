import { EntityRepository } from '@mikro-orm/knex';
import { Integration } from '../integration.entity';

export class MikroOrmIntegrationRepository extends EntityRepository<Integration> { }
