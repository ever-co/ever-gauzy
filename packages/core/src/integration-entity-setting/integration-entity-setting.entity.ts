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
import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';
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
export class IntegrationEntitySetting extends TenantOrganizationBaseEntity implements IIntegrationEntitySetting {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@Column()
	entity: string;

	@ApiProperty({ type: () => Boolean })
	@IsNotEmpty()
	@IsBoolean()
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
	@ManyToOne(() => IntegrationTenant, (integration) => integration.entitySettings, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	integration?: IIntegrationTenant;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: IntegrationEntitySetting) => it.integration)
	@Index()
	@Column()
	integrationId?: IIntegrationTenant['id'];

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
