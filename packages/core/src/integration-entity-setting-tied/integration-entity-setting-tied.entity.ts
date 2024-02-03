import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, JoinColumn, RelationId, Index } from 'typeorm';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import {
	IIntegrationEntitySetting,
	IIntegrationEntitySettingTied,
	IntegrationEntity
} from '@gauzy/contracts';
import {
	IntegrationEntitySetting,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmIntegrationEntitySettingTiedRepository } from './repository/mikro-orm-integration-entity-setting-tied.repository';
import { MultiORMManyToOne } from 'core/decorators/entity/relations';

@MultiORMEntity('integration_entity_setting_tied', { mikroOrmRepository: () => MikroOrmIntegrationEntitySettingTiedRepository })
export class IntegrationEntitySettingTied extends TenantOrganizationBaseEntity implements IIntegrationEntitySettingTied {

	@ApiProperty({ type: () => String, enum: IntegrationEntity })
	@IsNotEmpty()
	@IsEnum(IntegrationEntity)
	@Column()
	entity: IntegrationEntity;

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
	 * IntegrationEntitySetting
	 */
	@MultiORMManyToOne(() => IntegrationEntitySetting, (it) => it.tiedEntities, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	integrationEntitySetting?: IIntegrationEntitySetting;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: IntegrationEntitySettingTied) => it.integrationEntitySetting)
	@Index()
	@Column({ nullable: true })
	integrationEntitySettingId?: IIntegrationEntitySetting['id'];
}
