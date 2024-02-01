import { EntityRepository } from '@mikro-orm/core';
import { IntegrationType } from '../integration-type.entity';

export class MikroOrmIntegrationTypeRepository extends EntityRepository<IntegrationType> { }
