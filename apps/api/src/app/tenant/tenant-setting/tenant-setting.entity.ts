import { ApiProperty } from '@nestjs/swagger';
import {
	Entity,
	Column,
	Index,
	JoinColumn,
	ManyToOne,
	RelationId
} from 'typeorm';
import { ITenant } from '@gauzy/models';
import { IsOptional, IsString } from 'class-validator';
import { TenantBase } from '../../core/entities/tenant-base';
import { Tenant } from '../tenant.entity';

@Entity('tenant_setting')
export class TenantSetting extends TenantBase implements ITenant {
	@ApiProperty({ type: String })
	@Column({ nullable: false })
	name?: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	value?: string;

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
