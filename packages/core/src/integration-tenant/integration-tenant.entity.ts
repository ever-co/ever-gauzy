import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, OneToMany } from 'typeorm';
import { IIntegrationEntitySetting, IIntegrationMap, IIntegrationSetting, IIntegrationTenant } from '@gauzy/contracts';
import {
	IntegrationEntitySetting,
	IntegrationMap,
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

	/**
	 * IntegrationMap
	 */
	@ApiPropertyOptional({ type: () => IntegrationMap, isArray: true })
	@OneToMany(() => IntegrationMap, (map) => map.integration, {
		cascade: true
	})
	@JoinColumn()
	entityMaps?: IIntegrationMap[];
}
