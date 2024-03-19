import { EntityRepository } from '@mikro-orm/knex';
import { RolePermission } from '../role-permission.entity';

export class MikroOrmRolePermissionRepository extends EntityRepository<RolePermission> { }
