import { ApiProperty } from '@nestjs/swagger';
import { ISystemSetting } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmSystemSettingRepository } from './repository/mikro-orm-system-setting.repository';

/**
 * SystemSetting Entity
 *
 * Stores system-wide, tenant-level, or organization-level configuration settings.
 * Uses partial unique indexes to properly handle NULL values in unique constraints:
 * - Global scope: unique on (name) where tenantId IS NULL AND organizationId IS NULL
 * - Tenant scope: unique on (name, tenantId) where tenantId IS NOT NULL AND organizationId IS NULL
 * - Organization scope: unique on (name, tenantId, organizationId) where both are NOT NULL
 *
 * Note: The partial unique indexes are created in the migration file since TypeORM's
 * @Index decorator with 'where' clause has limited support across different databases.
 */
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
