import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne } from 'typeorm';
import { DeepPartial, IIntegrationMap } from '@gauzy/common';
import { IntegrationTenant, TenantOrganizationBaseEntity } from '../internal';

@Entity('integration_map')
export class IntegrationMap
	extends TenantOrganizationBaseEntity
	implements IIntegrationMap {
	constructor(input?: DeepPartial<IntegrationMap>) {
		super(input);
	}

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
