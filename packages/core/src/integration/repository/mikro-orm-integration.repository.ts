import { EntityRepository } from '@mikro-orm/core';
import { Integration } from '../integration.entity';

export class MikroOrmIntegrationRepository extends EntityRepository<Integration> { }