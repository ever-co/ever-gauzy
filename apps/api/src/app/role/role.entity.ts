import { Column, Entity, Index, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';
import { TenantBase } from '../core/entities/tenant-base';
import { Role as IRole, RolesEnum } from '@gauzy/models';
import { RolePermissions } from '../role-permissions/role-permissions.entity';

@Entity('role')
export class Role extends TenantBase implements IRole {
	@ApiProperty({ type: String, enum: RolesEnum })
	@IsEnum(RolesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@OneToMany(
		(type) => RolePermissions,
		(rolePermission) => rolePermission.role
	)
	rolePermissions: RolePermissions[];
}
