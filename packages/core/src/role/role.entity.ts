import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';
import { RolesEnum, IRolePermission, IRole } from '@gauzy/contracts';
import { RolePermission, TenantBaseEntity } from '../core/entities/internal';

@Entity('role')
export class Role extends TenantBaseEntity implements IRole {

	@ApiProperty({ type: () => String, enum: RolesEnum })
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Column({ default: false })
	isSystem?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Role Permissions
	 */
	@OneToMany(() => RolePermission, (rolePermission) => rolePermission.role, {
		cascade: true
	})
	rolePermissions?: IRolePermission[];
}
