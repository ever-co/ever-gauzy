import { EntityRepository } from '@mikro-orm/core';
import { OrganizationPosition } from '../organization-position.entity';

export class MikroOrmOrganizationPositionRepository extends EntityRepository<OrganizationPosition> { }