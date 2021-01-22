import { ApiProperty } from '@nestjs/swagger';
import { Column, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsOptional, IsString } from 'class-validator';
import {
	IOrganization,
	IBasePerTenantAndOrganizationEntityModel,
	ITenant
} from '@gauzy/common';
import { Base, Organization, Tenant } from './internal';

export abstract class TenantOrganizationBase
	extends Base
	implements IBasePerTenantAndOrganizationEntityModel {
	@ApiProperty({ type: Organization, readOnly: true })
	@ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
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
	@ManyToOne(() => Tenant, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	@IsOptional()
	tenant?: ITenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((t: TenantOrganizationBase) => t.tenant)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	tenantId?: string;
}
