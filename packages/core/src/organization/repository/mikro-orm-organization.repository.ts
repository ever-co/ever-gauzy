import { EntityRepository } from '@mikro-orm/core';
import { Organization } from '../organization.entity';

export class MikroOrmOrganizationRepository extends EntityRepository<Organization> { }