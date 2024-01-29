import { EntityRepository } from '@mikro-orm/core';
import { Role } from '../role.entity';

export class MikroOrmRoleRepository extends EntityRepository<Role> { }