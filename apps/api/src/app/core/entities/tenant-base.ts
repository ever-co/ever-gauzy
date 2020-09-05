import { ApiProperty } from '@nestjs/swagger';
import { Column, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { Base } from './base';
import { IsString } from 'class-validator';

export abstract class TenantBase extends Base {
	@ApiProperty({ type: Tenant })
	@ManyToOne((type) => Tenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	tenant: Tenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((t: TenantBase) => t.tenant)
  @IsString()
  @Column()
	readonly tenantId?: string;
}
