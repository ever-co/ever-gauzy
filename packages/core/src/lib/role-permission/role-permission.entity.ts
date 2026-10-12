
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId } from 'typeorm';
import { PermissionsEnum, IRolePermission } from '@gauzy/contracts';
import { Role, TenantBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmRolePermissionRepository } from './repository/mikro-orm-role-permission.repository';

/**
 * A role holds each permission once: `(tenantId, roleId, permission)` is UNIQUE.
 *
 * Without it, two processes reloading the default permissions at the same time each inserted the
 * ones they saw missing, and production collected millions of duplicate rows. The index (created by
 * `AddRolePermissionUniqueIndex1790000017000`) makes that impossible; the batched reload inserts
 * with an ignore-duplicates clause, so losing that race is harmless.
 */
@ColumnIndex('IDX_role_permission_unique', ['tenantId', 'roleId', 'permission'], {
	unique: true
})
@MultiORMEntity('role_permission', { mikroOrmRepository: () => MikroOrmRolePermissionRepository })
export class RolePermission extends TenantBaseEntity implements IRolePermission {

	@ApiProperty({ type: () => String, enum: PermissionsEnum })
	@ColumnIndex()
	@MultiORMColumn()
	permission: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@MultiORMColumn({ nullable: true, default: false })
	enabled: boolean;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	description: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@MultiORMManyToOne(() => Role, (it) => it.rolePermissions, {
		onDelete: 'CASCADE'
	})
	role: Role;

	@ApiProperty({ type: () => String })
	@RelationId((it: RolePermission) => it.role)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	roleId: string;
}
