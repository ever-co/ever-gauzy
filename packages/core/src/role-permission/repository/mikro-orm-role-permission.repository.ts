import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { RolePermission } from '../role-permission.entity';

export class MikroOrmRolePermissionRepository extends MikroOrmBaseEntityRepository<RolePermission> { }
