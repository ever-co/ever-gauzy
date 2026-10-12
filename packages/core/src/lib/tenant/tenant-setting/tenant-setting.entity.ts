import { ApiProperty } from '@nestjs/swagger';
import { ITenant } from '@gauzy/contracts';
import { TenantBaseEntity } from '../../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from '../../core/decorators/entity';
import { MikroOrmTenantSettingRepository } from './repository/mikro-orm-tenant-setting.repository';
import { ExportRedacted } from '../../export-import/export-redact.decorator';
import { isSecretTenantSettingName } from './tenant-setting.utils';

@MultiORMEntity('tenant_setting', { mikroOrmRepository: () => MikroOrmTenantSettingRepository })
export class TenantSetting extends TenantBaseEntity implements ITenant {

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: false })
	name?: string;

	/**
	 * 🛑 Holds the tenant's object-storage secret access keys (AWS/Wasabi/DigitalOcean), the
	 * Cloudinary API secret and the monitoring keys and Sentry DSN. `TenantSettingGetHandler` masks
	 * them with
	 * `WrapSecrets` on the JSON path; the CSV export never reaches that handler
	 * (GHSA-j5h5-r956-rxc3). Default-deny, see {@link isSecretTenantSettingName}.
	 */
	@ExportRedacted<TenantSetting>({ when: (it) => isSecretTenantSettingName(it.name) })
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	value?: string;
}
