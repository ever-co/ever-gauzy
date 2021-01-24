import { ApiProperty } from '@nestjs/swagger';
import {
	BaseEntity,
	FeatureOrganization,
	Organization,
	RolePermissions
} from '../core/entities/internal';
import { Entity, Column, Index, OneToMany, JoinColumn } from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	ITenant,
	IOrganization,
	IRolePermission,
	IFeatureOrganization
} from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';

@Entity('tenant')
export class Tenant extends BaseEntity implements ITenant {
	constructor(input?: DeepPartial<Tenant>) {
		super(input);
	}

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
	@OneToMany(() => RolePermissions, (rolePermission) => rolePermission.tenant)
	rolePermissions?: IRolePermission[];

	@ApiProperty({ type: FeatureOrganization })
	@OneToMany(
		() => FeatureOrganization,
		(featureOrganization) => featureOrganization.tenant
	)
	featureOrganizations?: IFeatureOrganization[];
}
