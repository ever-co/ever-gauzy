import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	Column,
	Entity,
	JoinColumn,
	RelationId,
	ManyToOne,
	OneToMany
} from 'typeorm';
import {
	IIntegrationEntitySetting,
	IIntegrationEntitySettingTied,
	IIntegrationTenant
} from '@gauzy/contracts';
import {
	IntegrationEntitySettingTiedEntity,
	IntegrationTenant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('integration_entity_setting')
export class IntegrationEntitySetting
	extends TenantOrganizationBaseEntity
	implements IIntegrationEntitySetting {
	@ApiPropertyOptional({ type: () => IntegrationTenant })
	@ManyToOne(
		() => IntegrationTenant,
		(integration) => integration.entitySettings
	)
	@JoinColumn()
	integration?: IIntegrationTenant;

	@ApiProperty({ type: () => String, readOnly: true })
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
		() => IntegrationEntitySettingTiedEntity,
		(tiedEntity) => tiedEntity.integrationEntitySetting,
		{
			cascade: true
		}
	)
	@JoinColumn()
	tiedEntities?: IIntegrationEntitySettingTied[];

	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	entity: string;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: false })
	sync: boolean;
}
