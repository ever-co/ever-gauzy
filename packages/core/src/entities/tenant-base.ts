import { ApiProperty } from '@nestjs/swagger';
import { Column, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsString, IsOptional } from 'class-validator';
import { IBasePerTenantEntityModel, ITenant } from '@gauzy/common';
import { Base, Tenant } from './internal';
export abstract class TenantBase
	extends Base
	implements IBasePerTenantEntityModel {
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
