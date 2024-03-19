import { EntityRepository } from '@mikro-orm/knex';
import { IntegrationType } from '../integration-type.entity';

export class MikroOrmIntegrationTypeRepository extends EntityRepository<IntegrationType> { }
