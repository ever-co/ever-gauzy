import {
	Column,
	Entity,
	Index,
	OneToMany,
	ManyToOne,
	JoinColumn,
	RelationId
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { RolesEnum, IRolePermission, IRole, ITenant } from '@gauzy/models';
import { RolePermissions } from '../role-permissions/role-permissions.entity';
import { Base } from '../core/entities/base';
import { Tenant } from '../tenant/tenant.entity';

@Entity('role')
export class Role extends Base implements IRole {
	@ApiProperty({ type: Tenant, readOnly: true })
	@ManyToOne((type) => Tenant, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	@IsOptional()
	tenant?: ITenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((t: Role) => t.tenant)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	tenantId?: string;

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
	rolePermissions: IRolePermission[];
}
