import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne } from 'typeorm';
import { IIntegrationSetting } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { IntegrationTenant, TenantOrganizationBaseEntity } from '../internal';

@Entity('integration_setting')
export class IntegrationSetting
	extends TenantOrganizationBaseEntity
	implements IIntegrationSetting {
	constructor(input?: DeepPartial<IntegrationSetting>) {
		super(input);
	}

	@ApiProperty({ type: IntegrationTenant })
	@ManyToOne(() => IntegrationTenant, {
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
