import { ApiProperty } from '@nestjs/swagger';
import { Column, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsString, IsOptional } from 'class-validator';
import { IBasePerTenantEntityModel, ITenant } from '@gauzy/contracts';
import { MikroManyToOne } from '@gauzy/common';
import { BaseEntity, Tenant } from '../entities/internal';
import { Cascade, Property } from '@mikro-orm/core';

export abstract class TenantBaseEntity extends BaseEntity implements IBasePerTenantEntityModel {

	@ApiProperty({ type: () => Tenant, readOnly: true })
	@ManyToOne(() => Tenant, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@MikroManyToOne(() => Tenant, {
		nullable: true,
		deleteRule: 'cascade',
		persist: false,
	})
	@JoinColumn()
	@IsOptional()
	tenant?: ITenant;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((t: TenantBaseEntity) => t.tenant)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	@Property({ nullable: true, })
	tenantId?: ITenant['id'];
}
