import { ApiProperty } from '@nestjs/swagger';
import { ISystemSetting } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmSystemSettingRepository } from './repository/mikro-orm-system-setting.repository';

@MultiORMEntity('system_setting', { mikroOrmRepository: () => MikroOrmSystemSettingRepository })
export class SystemSetting extends TenantOrganizationBaseEntity implements ISystemSetting {
	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn({ nullable: false })
	name: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: 'text', nullable: true })
	value?: string;
}
