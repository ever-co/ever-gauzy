import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne, Index } from 'typeorm';
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import {
	IIntegrationEntitySetting,
	IIntegrationEntitySettingTied
} from '@gauzy/contracts';
import {
	IntegrationEntitySetting,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
@Entity('integration_entity_setting_tied')
export class IntegrationEntitySettingTied extends TenantOrganizationBaseEntity implements IIntegrationEntitySettingTied {

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
	 * IntegrationEntitySetting
	 */
	@ManyToOne(() => IntegrationEntitySetting, (it) => it.tiedEntities, {
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
