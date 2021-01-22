import { ApiProperty } from '@nestjs/swagger';
import { Column, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsString, IsOptional } from 'class-validator';
import { DeepPartial, IBasePerTenantEntityModel, ITenant } from '@gauzy/common';
import { BaseEntity, Tenant } from '../internal';

export abstract class TenantBaseEntity
	extends BaseEntity
	implements IBasePerTenantEntityModel {
	constructor(input?: DeepPartial<TenantBaseEntity>) {
		super(input);
	}

	@ApiProperty({ type: Tenant, readOnly: true })
	@ManyToOne(() => Tenant, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	@IsOptional()
	tenant?: ITenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((t: TenantBaseEntity) => t.tenant)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	tenantId?: string;
}
