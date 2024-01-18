import { ApiProperty } from '@nestjs/swagger';
import { Column, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsOptional, IsString } from 'class-validator';
import {
	IOrganization,
	IBasePerTenantAndOrganizationEntityModel
} from '@gauzy/contracts';
import { Organization, TenantBaseEntity } from '../entities/internal';
import { MikroManyToOne } from '@gauzy/common';
import { Cascade, Property } from '@mikro-orm/core';

export abstract class TenantOrganizationBaseEntity extends TenantBaseEntity implements IBasePerTenantAndOrganizationEntityModel {

	@ApiProperty({ type: () => Organization, readOnly: true })
	@ManyToOne(() => Organization, {
		nullable: true,
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@MikroManyToOne(() => Organization, {
		nullable: true,
		deleteRule: 'cascade',
		updateRule: 'cascade',
		persist: false
	})
	@JoinColumn()
	@IsOptional()
	organization?: IOrganization;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: TenantOrganizationBaseEntity) => it.organization)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	@Property({ nullable: true })
	organizationId?: IOrganization['id'];
}
