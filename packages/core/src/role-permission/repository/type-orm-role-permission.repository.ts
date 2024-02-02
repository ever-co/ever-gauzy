import { Repository } from 'typeorm';
import { RolePermission } from '../role-permission.entity';

export class TypeOrmRolePermissionRepository extends Repository<RolePermission> { }