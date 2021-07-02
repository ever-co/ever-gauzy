import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne, Index } from 'typeorm';
import { IIntegrationSetting } from '@gauzy/contracts';
import {
	IntegrationTenant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { IsString } from 'class-validator';

@Entity('integration_setting')
export class IntegrationSetting
	extends TenantOrganizationBaseEntity
	implements IIntegrationSetting {
		
	@ApiProperty({ type: () => IntegrationTenant })
	@ManyToOne(() => IntegrationTenant, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	integration: IntegrationTenant;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: IntegrationSetting) => it.integration)
	@IsString()
	@Index()
	@Column({ nullable: false })
	readonly integrationId: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	settingsName: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	settingsValue: string;
}
