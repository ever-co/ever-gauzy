import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne, Index } from 'typeorm';
import { IsOptional, IsString } from 'class-validator';
import {
	IIntegrationEntitySetting,
	IIntegrationEntitySettingTied
} from '@gauzy/contracts';
import {
	IntegrationEntitySetting,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('integration_entity_setting_tied_entity')
export class IntegrationEntitySettingTiedEntity
	extends TenantOrganizationBaseEntity
	implements IIntegrationEntitySettingTied {
	
	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	entity: string;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: false })
	sync: boolean;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * IntegrationEntitySetting
	 */
	@ApiProperty({ type: () => IntegrationEntitySetting })
	@ManyToOne(() => IntegrationEntitySetting, (integrationEntitySetting) => integrationEntitySetting.tiedEntities)
	@JoinColumn()
	integrationEntitySetting?: IIntegrationEntitySetting;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: IntegrationEntitySettingTiedEntity) => it.integrationEntitySetting)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	readonly integrationEntitySettingId?: string;
}
