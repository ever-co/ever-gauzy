import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	Column,
	Entity,
	JoinColumn,
	RelationId,
	ManyToOne,
	OneToMany,
	Index
} from 'typeorm';
import { IsString } from 'class-validator';
import {
	IIntegrationEntitySetting,
	IIntegrationEntitySettingTied,
	IIntegrationTenant
} from '@gauzy/contracts';
import {
	IntegrationEntitySettingTied,
	IntegrationTenant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('integration_entity_setting')
export class IntegrationEntitySetting
	extends TenantOrganizationBaseEntity
	implements IIntegrationEntitySetting {

	@ApiProperty({ type: () => String })
	@Column()
	entity: string;

	@ApiProperty({ type: () => Boolean })
	@Column()
	sync: boolean;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * IntegrationTenant
	 */
	@ApiPropertyOptional({ type: () => IntegrationTenant })
	@ManyToOne(() => IntegrationTenant, (integration) => integration.entitySettings)
	@JoinColumn()
	integration?: IIntegrationTenant;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: IntegrationEntitySetting) => it.integration)
	@IsString()
	@Index()
	@Column()
	readonly integrationId?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */

	@ApiPropertyOptional({ type: IntegrationEntitySettingTied, isArray: true })
	@OneToMany(() => IntegrationEntitySettingTied, (tiedEntity) => tiedEntity.integrationEntitySetting, {
		cascade: true 
	})
	@JoinColumn()
	tiedEntities?: IIntegrationEntitySettingTied[];
}
