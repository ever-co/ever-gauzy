import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { Entity, Column, Index, OneToMany, JoinColumn } from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import { ITenant, IOrganization, IRolePermission } from '@gauzy/models';
import { Organization } from '../organization/organization.entity';
import { RolePermissions } from '../role-permissions/role-permissions.entity';

@Entity('tenant')
export class Tenant extends Base implements ITenant {
	@ApiProperty({ type: String })
	@Index()
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: false })
	name?: string;

	@ApiProperty({ type: Organization })
	@OneToMany(() => Organization, (organization) => organization.tenant)
	@JoinColumn()
	organizations?: IOrganization[];

	@OneToMany(
		(type) => RolePermissions,
		(rolePermission) => rolePermission.tenant
	)
	rolePermissions?: IRolePermission[];
}
