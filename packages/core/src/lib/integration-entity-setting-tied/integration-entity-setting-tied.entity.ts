import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
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
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmIntegrationEntitySettingTiedRepository } from './repository/mikro-orm-integration-entity-setting-tied.repository';

@MultiORMEntity('integration_entity_setting_tied', { mikroOrmRepository: () => MikroOrmIntegrationEntitySettingTiedRepository })
export class IntegrationEntitySettingTied extends TenantOrganizationBaseEntity implements IIntegrationEntitySettingTied {

	@ApiProperty({ type: () => String, enum: IntegrationEntity })
	@IsNotEmpty()
	@IsEnum(IntegrationEntity)
	@MultiORMColumn()
	entity: IntegrationEntity;

	@ApiProperty({ type: () => Boolean })
	@IsNotEmpty()
	@IsBoolean()
	@MultiORMColumn()
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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	integrationEntitySettingId?: IIntegrationEntitySetting['id'];
}
