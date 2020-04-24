import { ApiProperty } from '@nestjs/swagger';
import { JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { Base } from './base';

export abstract class TenantBase extends Base {
	@ApiProperty({ type: Tenant })
	@ManyToOne((type) => Tenant, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	tenant: Tenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((t: TenantBase) => t.tenant)
	readonly tenantId?: string;
}
