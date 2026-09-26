import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ITenant, ID } from '@gauzy/contracts';
import { TenantBaseEntity } from '../../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity } from '../../core/decorators/entity';
import { SettingScope } from '../../core/enums/kernel-extension.enums';
import { MikroOrmTenantSettingRepository } from './repository/mikro-orm-tenant-setting.repository';
import { ExportRedacted } from '../../export-import/export-redact.decorator';
import { isSecretTenantSettingName } from './tenant-setting.utils';

/**
 * One configurable knob, addressed by scope, instead of a column per option on the channel, the
 * organization and the tenant.
 *
 * The table keeps the base class it already had — a tenant id and **no** organization id — so the
 * organization column below is added explicitly, and a row with a null `organizationId` is a
 * tenant-wide setting, which is what every existing row is. The key column stays `name`: renaming a
 * NOT NULL core column is not an additive change, so the uniqueness tuples below name `name`.
 */
@ColumnIndex('UQ_tenant_setting_org_scope_name', ['organizationId', 'scope', 'name'], {
	unique: true,
	where: '"organizationId" IS NOT NULL AND "channelId" IS NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('UQ_tenant_setting_org_scope_channel_name', ['organizationId', 'scope', 'channelId', 'name'], {
	unique: true,
	where: '"channelId" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_tenant_setting_tenant_name', ['tenantId', 'name'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_tenant_setting_channel', ['channelId'], { where: '"channelId" IS NOT NULL' })
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

	/**
	 * The organization the setting belongs to. Null means tenant-wide, which is the scope of every row
	 * created before this column existed.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	organizationId?: ID;

	/**
	 * The channel the setting is scoped to; non-null exactly when `scope` is `CHANNEL`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	channelId?: ID;

	/**
	 * The scope the row is addressed at. The resolver layers the three scopes and the most specific
	 * value wins, so a missing row is never an error: it falls through to the next scope and finally to
	 * the compiled default.
	 */
	@ApiPropertyOptional({ type: () => String, enum: SettingScope, default: SettingScope.TENANT })
	@IsEnum(SettingScope)
	@MultiORMColumn({ type: 'simple-enum', enum: SettingScope, default: SettingScope.TENANT })
	scope?: SettingScope;

	/**
	 * The structured value: an object, an array, a number or a boolean. Null on a legacy scalar row,
	 * whose value is `value` — the reader prefers this column and otherwise parses `value` according to
	 * `valueType`, so a client that knows only the scalar form observes exactly what it did before.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<unknown>({ nullable: true })
	valueJson?: unknown;

	/**
	 * How the stored value must be read; validated against the value on write.
	 */
	@ApiPropertyOptional({ type: () => String, default: 'STRING' })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	@MultiORMColumn({ type: 'varchar', length: 16, default: 'STRING' })
	valueType?: string;

	/**
	 * The value is sensitive: masked in every response and excluded from the settings dump.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isEncrypted?: boolean;

	/**
	 * Admin-facing explanation of the key.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	description?: string;
}
