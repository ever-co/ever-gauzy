import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne } from 'typeorm';
import { Base } from '../core/entities/base';
import { IIntegrationSetting } from '@gauzy/models';
import { Integration } from '../integration/integration.entity';

@Entity('integration_setting')
export class IntegrationSetting extends Base implements IIntegrationSetting {
	@ApiProperty({ type: Integration })
	@ManyToOne((type) => Integration, {
		nullable: false
	})
	@JoinColumn()
	integration: Integration;

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
