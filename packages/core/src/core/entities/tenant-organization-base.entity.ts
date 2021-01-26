import { ApiProperty } from '@nestjs/swagger';
import { Column, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsOptional, IsString } from 'class-validator';
import {
	IOrganization,
	IBasePerTenantAndOrganizationEntityModel
} from '@gauzy/contracts';
import { Organization, TenantBaseEntity } from '../entities/internal';

export abstract class TenantOrganizationBaseEntity
	extends TenantBaseEntity
	implements IBasePerTenantAndOrganizationEntityModel {
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
