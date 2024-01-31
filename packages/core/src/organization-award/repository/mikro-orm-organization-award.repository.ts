import { EntityRepository } from '@mikro-orm/core';
import { OrganizationAward } from '../organization-award.entity';

export class MikroOrmOrganizationAwardRepository extends EntityRepository<OrganizationAward> { }