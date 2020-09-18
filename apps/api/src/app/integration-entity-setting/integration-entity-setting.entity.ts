import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	Column,
	Entity,
	JoinColumn,
	RelationId,
	ManyToOne,
	OneToMany
} from 'typeorm';
import { IIntegrationEntitySetting } from '@gauzy/models';
import { IntegrationTenant } from '../integration-tenant/integration-tenant.entity';
import { IntegrationEntitySettingTiedEntity } from '../integration-entity-setting-tied-entity/integration-entity-setting-tied-entity.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('integration_entity_setting')
export class IntegrationEntitySetting extends TenantBase
	implements IIntegrationEntitySetting {
	@ApiPropertyOptional({ type: IntegrationTenant })
	@ManyToOne(
		(type) => IntegrationTenant,
		(integration) => integration.entitySettings
	)
	@JoinColumn()
	integration?: IntegrationTenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(integrationEntity: IntegrationEntitySetting) =>
			integrationEntity.integration
	)
	readonly integrationId?: string;

	@ApiPropertyOptional({
		type: IntegrationEntitySettingTiedEntity,
		isArray: true
	})
	@OneToMany(
		(type) => IntegrationEntitySettingTiedEntity,
		(tiedEntity) => tiedEntity.integrationEntitySetting,
		{ cascade: true }
	)
	@JoinColumn()
	tiedEntities?: IntegrationEntitySettingTiedEntity[];

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	entity: string;

	@ApiProperty({ type: Boolean })
	@Column({ nullable: false })
	sync: boolean;
}
