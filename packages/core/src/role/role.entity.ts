import { Column, Entity, Index, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';
import { RolesEnum, IRolePermission, IRole } from '@gauzy/contracts';
import { RolePermissions, TenantBaseEntity } from '../core/entities/internal';

@Entity('role')
export class Role extends TenantBaseEntity implements IRole {
	@ApiProperty({ type: () => String, enum: RolesEnum })
	@IsEnum(RolesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@OneToMany(() => RolePermissions, (rolePermission) => rolePermission.role)
	rolePermissions: IRolePermission[];
}
