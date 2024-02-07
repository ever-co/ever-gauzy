import {
	PermissionsEnum,
	IRolePermission
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Index, RelationId } from 'typeorm';
import { Role, TenantBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmRolePermissionRepository } from './repository/mikro-orm-role-permission.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('role_permission', { mikroOrmRepository: () => MikroOrmRolePermissionRepository })
export class RolePermission extends TenantBaseEntity
	implements IRolePermission {

	@ApiProperty({ type: () => String, enum: PermissionsEnum })
	@Index()
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
	@MultiORMManyToOne(() => Role, (role) => role.rolePermissions, {
		onDelete: 'CASCADE'
	})
	role: Role;

	@ApiProperty({ type: () => String })
	@RelationId((it: RolePermission) => it.role)
	@Index()
	@MultiORMColumn()
	roleId: string;
}
