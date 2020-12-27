import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { Entity, Column, Index, OneToMany, JoinColumn } from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	ITenant,
	IOrganization,
	IRolePermission,
	IFeatureOrganization
} from '@gauzy/models';
import { Organization } from '../organization/organization.entity';
import { RolePermissions } from '../role-permissions/role-permissions.entity';
import { FeatureOrganization } from '../feature/feature_organization.entity';

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

	@ApiProperty({ type: RolePermissions })
	@OneToMany(
		(type) => RolePermissions,
		(rolePermission) => rolePermission.tenant
	)
	rolePermissions?: IRolePermission[];

	@ApiProperty({ type: FeatureOrganization })
	@OneToMany(
		(type) => FeatureOrganization,
		(featureOrganization) => featureOrganization.tenant
	)
	featureOrganizations?: IFeatureOrganization[];
}
