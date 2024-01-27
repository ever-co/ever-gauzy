import { ApiProperty } from '@nestjs/swagger';
import { Column } from 'typeorm';
import { ITenant } from '@gauzy/contracts';
import { TenantBaseEntity } from '../../core/entities/internal';
import { MultiORMEntity } from '../../core/decorators/entity';

@MultiORMEntity('tenant_setting')
export class TenantSetting extends TenantBaseEntity implements ITenant {
	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	name?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	value?: string;
}
