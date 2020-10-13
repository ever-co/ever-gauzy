import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne } from 'typeorm';
import {
	IIntegrationEntitySetting,
	IIntegrationEntitySettingTied
} from '@gauzy/models';
import { IntegrationEntitySetting } from '../integration-entity-setting/integration-entity-setting.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';
@Entity('integration_entity_setting_tied_entity')
export class IntegrationEntitySettingTiedEntity
	extends TenantOrganizationBase
	implements IIntegrationEntitySettingTied {
	@ApiProperty({ type: IntegrationEntitySetting })
	@ManyToOne(
		(type) => IntegrationEntitySetting,
		(integrationEntitySetting) => integrationEntitySetting.tiedEntities
	)
	@JoinColumn()
	integrationEntitySetting?: IIntegrationEntitySetting;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(integrationEntityTiedSetting: IntegrationEntitySettingTiedEntity) =>
			integrationEntityTiedSetting.integrationEntitySetting
	)
	readonly integrationEntitySettingId?: string;

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	entity: string;

	@ApiProperty({ type: Boolean })
	@Column({ nullable: false })
	sync: boolean;
}
