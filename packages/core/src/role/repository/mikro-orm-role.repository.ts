import { EntityRepository } from '@mikro-orm/knex';
import { Role } from '../role.entity';

export class MikroOrmRoleRepository extends EntityRepository<Role> { }
