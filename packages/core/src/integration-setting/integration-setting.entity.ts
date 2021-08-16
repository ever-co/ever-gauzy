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
		
	@ApiProperty({ type: () => String })
	@Column()
	settingsName: string;

	@ApiProperty({ type: () => String })
	@Column()
	settingsValue: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * IntegrationTenant
	 */
	@ApiProperty({ type: () => IntegrationTenant })
	@ManyToOne(() => IntegrationTenant, (integrationTenant) => integrationTenant.settings, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	integration?: IntegrationTenant;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: IntegrationSetting) => it.integration)
	@IsString()
	@Index()
	@Column()
	readonly integrationId?: string;
}
