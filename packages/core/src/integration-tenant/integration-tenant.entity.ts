import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, OneToMany } from 'typeorm';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { IIntegrationEntitySetting, IIntegrationMap, IIntegrationSetting, IIntegrationTenant, IntegrationEnum } from '@gauzy/contracts';
import {
	IntegrationEntitySetting,
	IntegrationMap,
	IntegrationSetting,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('integration_tenant')
export class IntegrationTenant extends TenantOrganizationBaseEntity implements IIntegrationTenant {

	@ApiProperty({ type: () => String, enum: IntegrationEnum })
	@IsNotEmpty()
	@IsEnum(IntegrationEnum)
	@Column()
	name: IntegrationEnum;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * IntegrationSetting
	 */
	@OneToMany(() => IntegrationSetting, (setting) => setting.integration, {
		cascade: true
	})
	@JoinColumn()
	settings?: IIntegrationSetting[];

	/**
	 * IntegrationEntitySetting
	 */
	@OneToMany(() => IntegrationEntitySetting, (setting) => setting.integration, {
		cascade: true
	})
	@JoinColumn()
	entitySettings?: IIntegrationEntitySetting[];

	/**
	 * IntegrationMap
	 */
	@OneToMany(() => IntegrationMap, (map) => map.integration, {
		cascade: true
	})
	@JoinColumn()
	entityMaps?: IIntegrationMap[];
}
