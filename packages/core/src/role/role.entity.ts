import { Column, Entity, Index, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';
import { RolesEnum, IRolePermission, IRole } from '@gauzy/contracts';
import { RolePermission, TenantBaseEntity } from '../core/entities/internal';

@Entity('role')
export class Role extends TenantBaseEntity implements IRole {
	@ApiProperty({ type: () => String, enum: RolesEnum })
	@IsEnum(RolesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@OneToMany(() => RolePermission, (rolePermission) => rolePermission.role, {
		cascade: true
	})
	rolePermissions: IRolePermission[];
}
