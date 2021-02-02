import { ApiProperty } from '@nestjs/swagger';
import { Column, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsString, IsOptional } from 'class-validator';
import { IBasePerTenantEntityModel, ITenant } from '@gauzy/contracts';
import { BaseEntity, Tenant } from '../entities/internal';

export abstract class TenantBaseEntity
	extends BaseEntity
	implements IBasePerTenantEntityModel {
	@ApiProperty({ type: () => Tenant, readOnly: true })
	@ManyToOne(() => Tenant, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	@IsOptional()
	tenant?: ITenant;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((t: TenantBaseEntity) => t.tenant)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	tenantId?: string;
}
