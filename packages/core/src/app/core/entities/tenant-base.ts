import { ApiProperty } from '@nestjs/swagger';
import { Column, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { Base } from './base';
import { IsString, IsOptional } from 'class-validator';
import { IBasePerTenantEntityModel, ITenant } from '@gauzy/contracts';

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
