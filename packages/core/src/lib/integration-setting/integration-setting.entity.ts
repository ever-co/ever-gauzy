import { ApiProperty } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { Exclude, Expose } from 'class-transformer';
import { IIntegrationSetting } from '@gauzy/contracts';
import {
	IntegrationTenant,
	TenantOrganizationBaseEntity
} from './../core/entities/internal';
import { IsSecret } from './../core/decorators';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmIntegrationSettingRepository } from './repository/mikro-orm-integration-setting.repository';
import { ExportRedacted } from './../export-import/export-redact.decorator';
import { nonSecretSettingKeys } from './integration-setting.utils';

@MultiORMEntity('integration_setting', { mikroOrmRepository: () => MikroOrmIntegrationSettingRepository })
export class IntegrationSetting extends TenantOrganizationBaseEntity implements IIntegrationSetting {

	@Exclude({ toPlainOnly: true })
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn()
	settingsName: string;

	/**
	 * 🛑 Every integration plugin writes its credentials into this one column — Hubstaff/Upwork/
	 * GitHub/Zapier/Make.com OAuth access and refresh tokens, Activepieces and Plane API keys,
	 * client secrets. `@Exclude` hides it on the JSON path only; the CSV export reads the property
	 * directly, which is how those tokens left the system in cleartext (GHSA-j5h5-r956-rxc3).
	 *
	 * The predicate is exactly the default-deny policy `IntegrationSettingSubscriber` already
	 * applies to the JSON path, so the two cannot drift: a value is a secret unless its
	 * `settingsName` is on the explicit non-secret allowlist.
	 */
	@ExportRedacted<IntegrationSetting>({ when: (it) => !nonSecretSettingKeys.includes(it.settingsName) })
	@Exclude({ toPlainOnly: true })
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn()
	settingsValue: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * IntegrationTenant
	 */
	@MultiORMManyToOne(() => IntegrationTenant, (it) => it.settings, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	integration?: IntegrationTenant;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: IntegrationSetting) => it.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId?: IntegrationTenant['id'];

	/**
	 * Additional fields to expose secret fields
	 */
	@Expose({ toPlainOnly: true, name: 'settingsName' })
	@IsSecret()
	wrapSecretKey?: string;

	@Expose({ toPlainOnly: true, name: 'settingsValue' })
	@IsSecret()
	wrapSecretValue?: string;
}
