import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDateString, IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { IIntegration, IIntegrationEntitySetting, IIntegrationMap, IIntegrationSetting, IIntegrationTenant, IntegrationEnum } from '@gauzy/contracts';
import {
	Integration,
	IntegrationEntitySetting,
	IntegrationMap,
	IntegrationSetting,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmIntegrationTenantRepository } from './repository/mikro-orm-integration-tenant.repository';

@MultiORMEntity('integration_tenant', { mikroOrmRepository: () => MikroOrmIntegrationTenantRepository })
export class IntegrationTenant extends TenantOrganizationBaseEntity implements IIntegrationTenant {

	@ApiProperty({ type: () => String, enum: IntegrationEnum })
	@IsNotEmpty()
	@IsEnum(IntegrationEnum)
	@MultiORMColumn()
	name: IntegrationEnum;

	// Date when the integration was synced
	@ApiPropertyOptional({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, default: () => 'CURRENT_TIMESTAMP' })
	lastSyncedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Integration
	 */
	@MultiORMManyToOne(() => Integration, {

		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	integration?: IIntegration;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: IntegrationTenant) => it.integration)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	integrationId?: IIntegration['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * IntegrationSetting
	 */
	@MultiORMOneToMany(() => IntegrationSetting, (it) => it.integration, {
		cascade: true
	})
	@JoinColumn()
	settings?: IIntegrationSetting[];

	/**
	 * IntegrationEntitySetting
	 */
	@MultiORMOneToMany(() => IntegrationEntitySetting, (it) => it.integration, {
		cascade: true
	})
	@JoinColumn()
	entitySettings?: IIntegrationEntitySetting[];

	/**
	 * IntegrationMap
	 */
	@MultiORMOneToMany(() => IntegrationMap, (it) => it.integration, {
		cascade: true
	})
	@JoinColumn()
	entityMaps?: IIntegrationMap[];
}
