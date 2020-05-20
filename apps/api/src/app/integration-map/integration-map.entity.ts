import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne } from 'typeorm';
import { Base } from '../core/entities/base';
import { IIntegrationMap } from '@gauzy/models';
import { IntegrationTenant } from '../integration-tenant/integration-tenant.entity';

@Entity('integration_map')
export class IntegrationMap extends Base implements IIntegrationMap {
	@ApiProperty({ type: IntegrationTenant })
	@ManyToOne((type) => IntegrationTenant, {
		nullable: false
	})
	@JoinColumn()
	integration: IntegrationTenant;

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
