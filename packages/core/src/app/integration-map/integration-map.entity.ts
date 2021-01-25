import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne } from 'typeorm';
import { IIntegrationMap } from '@gauzy/contracts';
import {
	IntegrationTenant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('integration_map')
export class IntegrationMap
	extends TenantOrganizationBaseEntity
	implements IIntegrationMap {
	@ApiProperty({ type: IntegrationTenant })
	@ManyToOne(() => IntegrationTenant, {
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
