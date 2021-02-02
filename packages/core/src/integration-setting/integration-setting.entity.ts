import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne } from 'typeorm';
import { IIntegrationSetting } from '@gauzy/contracts';
import {
	IntegrationTenant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('integration_setting')
export class IntegrationSetting
	extends TenantOrganizationBaseEntity
	implements IIntegrationSetting {
	@ApiProperty({ type: () => IntegrationTenant })
	@ManyToOne(() => IntegrationTenant, {
		nullable: false
	})
	@JoinColumn()
	integration: IntegrationTenant;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId(
		(integrationSetting: IntegrationSetting) =>
			integrationSetting.integration
	)
	readonly integrationId: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	settingsName: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	settingsValue: string;
}
