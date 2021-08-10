import {
	PermissionsEnum,
	IRolePermission,
	RolesEnum
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { Role, TenantBaseEntity } from '../core/entities/internal';

@Entity('role_permission')
export class RolePermissions
	extends TenantBaseEntity
	implements IRolePermission {
	@ApiProperty({ type: () => String, enum: RolesEnum })
	@IsEnum(PermissionsEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	permission: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@Column({ nullable: true, default: false })
	enabled: boolean;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	@ManyToOne(() => Role, (role) => role.rolePermissions, {
		onDelete: 'CASCADE'
	})
	role!: Role;

	@ApiProperty({ type: () => String, enum: RolesEnum })
	@RelationId((it: RolePermissions) => it.role)
	@IsEnum(RolesEnum)
	@IsNotEmpty()
	@IsString()
	@Index()
	@Column()
	roleId: string;
}
