import {
	PermissionsEnum,
	IRolePermission
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Index, ManyToOne, RelationId } from 'typeorm';
import { Role, TenantBaseEntity } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmRolePermissionRepository } from './repository/mikro-orm-role-permission.repository';

@MultiORMEntity('role_permission', { mikroOrmRepository: () => MikroOrmRolePermissionRepository })
export class RolePermission extends TenantBaseEntity
	implements IRolePermission {

	@ApiProperty({ type: () => String, enum: PermissionsEnum })
	@Index()
	@Column()
	permission: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@Column({ nullable: true, default: false })
	enabled: boolean;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	description: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ManyToOne(() => Role, (role) => role.rolePermissions, {
		onDelete: 'CASCADE'
	})
	role: Role;

	@ApiProperty({ type: () => String })
	@RelationId((it: RolePermission) => it.role)
	@Index()
	@Column()
	roleId: string;
}
