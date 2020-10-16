import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column } from 'typeorm';
import { ITenant } from '@gauzy/models';
import { TenantBase } from '../../core/entities/tenant-base';

@Entity('tenant_setting')
export class TenantSetting extends TenantBase implements ITenant {
	@ApiProperty({ type: String })
	@Column({ nullable: false })
	name?: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	value?: string;
}
