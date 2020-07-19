import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne } from 'typeorm';
import { Base } from '../core/entities/base';
import { IIntegrationSetting } from '@gauzy/models';
import { IntegrationTenant } from '../integration-tenant/integration-tenant.entity';

@Entity('integration_setting')
export class IntegrationSetting extends Base implements IIntegrationSetting {
	@ApiProperty({ type: IntegrationTenant })
	@ManyToOne((type) => IntegrationTenant, {
		nullable: false
	})
	@JoinColumn()
	integration: IntegrationTenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(integrationSetting: IntegrationSetting) =>
			integrationSetting.integration
	)
	readonly integrationId: string;

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	settingsName: string;

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	settingsValue: string;
}
