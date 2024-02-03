import { ApiProperty } from '@nestjs/swagger';
import { Column, Index, JoinColumn, RelationId } from 'typeorm';
import { Property } from '@mikro-orm/core';
import { IsString, IsOptional } from 'class-validator';
import { IBasePerTenantEntityModel, ITenant } from '@gauzy/contracts';
import { BaseEntity, Tenant } from '../entities/internal';
import { MikroManyToOne } from '../../core/decorators/entity/relations/mikro-orm';
import { MultiORMManyToOne } from '../../core/decorators/entity/relations';

export abstract class TenantBaseEntity extends BaseEntity implements IBasePerTenantEntityModel {

	@ApiProperty({ type: () => Tenant })
	@MultiORMManyToOne(() => Tenant, {
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

	@ApiProperty({ type: () => String })
	@RelationId((t: TenantBaseEntity) => t.tenant)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	@Property({ nullable: true, })
	tenantId?: ITenant['id'];
}
