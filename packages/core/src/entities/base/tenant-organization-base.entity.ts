import { ApiProperty } from '@nestjs/swagger';
import { Column, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsOptional, IsString } from 'class-validator';
import {
	IOrganization,
	IBasePerTenantAndOrganizationEntityModel,
	DeepPartial
} from '@gauzy/common';
import { Organization, TenantBaseEntity } from '../internal';

export abstract class TenantOrganizationBaseEntity
	extends TenantBaseEntity
	implements IBasePerTenantAndOrganizationEntityModel {
	constructor(input?: DeepPartial<TenantOrganizationBaseEntity>) {
		super(input);
	}

	@ApiProperty({ type: Organization, readOnly: true })
	@ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	@IsOptional()
	organization?: IOrganization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((it: TenantOrganizationBaseEntity) => it.organization)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	organizationId?: string;
}
