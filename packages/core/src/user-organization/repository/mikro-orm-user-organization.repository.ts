import { EntityRepository } from '@mikro-orm/core';
import { UserOrganization } from '../user-organization.entity';

export class MikroOrmUserOrganizationRepository extends EntityRepository<UserOrganization> { }