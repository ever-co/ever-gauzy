import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne } from 'typeorm';
import { Base } from '../core/entities/base';
import { IIntegrationMap } from '@gauzy/models';
import { Integration } from '../integration/integration.entity';

@Entity('integration_map')
export class IntegrationMap extends Base implements IIntegrationMap {
	@ApiProperty({ type: Integration })
	@ManyToOne((type) => Integration, {
		nullable: false
	})
	@JoinColumn()
	integration: Integration;

	@ApiProperty({ type: String, readOnly: true })
	@Column()
	@RelationId(
		(integrationSetting: IntegrationMap) => integrationSetting.integration
	)
	readonly integrationId: string;

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	entity: string;

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	sourceId: string;

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	gauzyId: string;
}
