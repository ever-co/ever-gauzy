
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
/**
 * `TenantPermissionGuard` asks whether a TENANT holds any of a route's permissions, without a role
 * (`checkRolePermission` without `includeRole`), on every cache miss. By tenant alone that COUNT walked
 * every permission row of the tenant (17 million rows on production, 20–48 ms a call); with the
 * permission in the index it touches one row per role. Created by
 * `AddRolePermissionTenantPermissionIndex1791000004500` (CONCURRENTLY on Postgres).
 */
@ColumnIndex('IDX_role_permission_tenant_permission', ['tenantId', 'permission'])
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
