import {
	PermissionsEnum,
	IRolePermission as IRolePermissions,
	RolesEnum,
	ITenant
} from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
	Column,
	Entity,
	Index,
	ManyToOne,
	JoinColumn,
	RelationId
} from 'typeorm';
import { Role } from '../role/role.entity';
import { Base } from '../core/entities/base';
import { Tenant } from '../tenant/tenant.entity';

@Entity('role_permission')
export class RolePermissions extends Base implements IRolePermissions {
	@ApiProperty({ type: Tenant, readOnly: true })
	@ManyToOne((type) => Tenant, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	@IsOptional()
	tenant?: ITenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((t: RolePermissions) => t.tenant)
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	tenantId?: string;

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

	@ManyToOne((type) => Role, (role) => role.rolePermissions)
	role!: Role;
}
