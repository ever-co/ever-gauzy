import { EntityRepository } from '@mikro-orm/core';
import { RolePermission } from '../role-permission.entity';

export class MikroOrmRolePermissionRepository extends EntityRepository<RolePermission> { }