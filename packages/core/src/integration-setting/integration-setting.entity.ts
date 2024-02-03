import { ApiProperty } from '@nestjs/swagger';
import { Column, JoinColumn, RelationId, Index } from 'typeorm';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { Exclude, Expose } from 'class-transformer';
import { IIntegrationSetting } from '@gauzy/contracts';
import {
	IntegrationTenant,
	TenantOrganizationBaseEntity
} from './../core/entities/internal';
import { IsSecret } from './../core/decorators';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmIntegrationSettingRepository } from './repository/mikro-orm-integration-setting.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('integration_setting', { mikroOrmRepository: () => MikroOrmIntegrationSettingRepository })
export class IntegrationSetting extends TenantOrganizationBaseEntity implements IIntegrationSetting {

	@Exclude({ toPlainOnly: true })
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@Column()
	settingsName: string;

	@Exclude({ toPlainOnly: true })
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@Column()
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
	@Index()
	@Column()
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
