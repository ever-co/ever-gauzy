import { Column, Entity, Index, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';
import { RolesEnum, IRolePermission, IRole, DeepPartial } from '@gauzy/common';
import { RolePermissions, TenantBaseEntity } from '../internal';

@Entity('role')
export class Role extends TenantBaseEntity implements IRole {
	constructor(input?: DeepPartial<Role>) {
		super(input);
	}

	@ApiProperty({ type: String, enum: RolesEnum })
	@IsEnum(RolesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@OneToMany(() => RolePermissions, (rolePermission) => rolePermission.role)
	rolePermissions: IRolePermission[];
}
