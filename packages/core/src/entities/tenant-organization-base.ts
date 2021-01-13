import { ApiProperty } from '@nestjs/swagger';
import { Column, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsOptional, IsString } from 'class-validator';
import {
	IOrganization,
	IBasePerTenantAndOrganizationEntityModel,
	ITenant
} from '@gauzy/common';
import { Base } from './base';
import { TenantBase } from './tenant-base';
import { Organization } from './organization/organization.entity';
import { Tenant } from './tenant/tenant.entity';

export abstract class TenantOrganizationBase
	extends Base
	implements IBasePerTenantAndOrganizationEntityModel {
	@ApiProperty({ type: Organization, readOnly: true })
	@ManyToOne((type) => Organization, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	@IsOptional()
	organization?: IOrganization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((it: TenantOrganizationBase) => it.organization)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	organizationId?: string;

	@ApiProperty({ type: Tenant, readOnly: true })
	@ManyToOne((type) => Tenant, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	@IsOptional()
	tenant?: ITenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((t: TenantBase) => t.tenant)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	tenantId?: string;
}
