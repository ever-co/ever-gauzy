import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, OneToMany } from 'typeorm';
import { IIntegrationEntitySetting, IIntegrationSetting, IIntegrationTenant } from '@gauzy/contracts';
import {
	IntegrationEntitySetting,
	IntegrationSetting,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('integration_tenant')
export class IntegrationTenant
	extends TenantOrganizationBaseEntity
	implements IIntegrationTenant {
	
	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * IntegrationSetting
	 */
	@ApiPropertyOptional({ type: () => IntegrationSetting, isArray: true })
	@OneToMany(() => IntegrationSetting, (setting) => setting.integration, {
		cascade: true
	})
	@JoinColumn()
	settings?: IIntegrationSetting[];

	/**
	 * IntegrationEntitySetting
	 */
	@ApiPropertyOptional({ type: () => IntegrationEntitySetting, isArray: true })
	@OneToMany(() => IntegrationEntitySetting, (setting) => setting.integration, {
		cascade: true
	})
	@JoinColumn()
	entitySettings?: IIntegrationEntitySetting[];
}
