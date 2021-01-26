import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column } from 'typeorm';
import { ITenant } from '@gauzy/contracts';
import { TenantBaseEntity } from '../../core/entities/internal';

@Entity('tenant_setting')
export class TenantSetting extends TenantBaseEntity implements ITenant {
	@ApiProperty({ type: String })
	@Column({ nullable: false })
	name?: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	value?: string;
}
