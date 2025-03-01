import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';
import { RolesEnum, IRolePermission, IRole } from '@gauzy/contracts';
import { RolePermission, TenantBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmRoleRepository } from './repository/mikro-orm-role.repository';

@MultiORMEntity('role', { mikroOrmRepository: () => MikroOrmRoleRepository })
export class Role extends TenantBaseEntity implements IRole {
	@ApiProperty({ type: () => String, enum: RolesEnum })
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isSystem?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Role Permissions
	 */
	@MultiORMOneToMany(() => RolePermission, (it) => it.role, { cascade: true })
	rolePermissions?: IRolePermission[];
}
