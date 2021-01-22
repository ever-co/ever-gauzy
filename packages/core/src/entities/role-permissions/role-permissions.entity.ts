import {
	PermissionsEnum,
	IRolePermission as IRolePermissions,
	RolesEnum,
	DeepPartial
} from '@gauzy/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { Role, TenantBaseEntity } from '../internal';

@Entity('role_permission')
export class RolePermissions
	extends TenantBaseEntity
	implements IRolePermissions {
	constructor(input?: DeepPartial<RolePermissions>) {
		super(input);
	}

	@ApiProperty({ type: String, enum: RolesEnum })
	@IsEnum(RolesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	roleId: string;

	@ApiProperty({ type: String, enum: RolesEnum })
	@IsEnum(PermissionsEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	permission: string;

	@ApiPropertyOptional({ type: Boolean, default: false })
	@Column({ nullable: true, default: false })
	enabled: boolean;

	@ManyToOne(() => Role, (role) => role.rolePermissions)
	role!: Role;
}
