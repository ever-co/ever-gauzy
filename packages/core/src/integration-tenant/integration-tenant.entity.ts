import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, RelationId } from 'typeorm';
import { IsDateString, IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { IIntegration, IIntegrationEntitySetting, IIntegrationMap, IIntegrationSetting, IIntegrationTenant, IntegrationEnum } from '@gauzy/contracts';
import {
	Integration,
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

	// Date when the integration was synced
	@ApiPropertyOptional({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@IsDateString()
	@Index()
	@Column({ nullable: true, default: () => 'CURRENT_TIMESTAMP' })
	lastSyncedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Integration
	 */
	@ManyToOne(() => Integration, {

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
	@Index()
	@Column({ nullable: true })
	integrationId?: IIntegration['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * IntegrationSetting
	 */
	@OneToMany(() => IntegrationSetting, (it) => it.integration, {
		cascade: true
	})
	@JoinColumn()
	settings?: IIntegrationSetting[];

	/**
	 * IntegrationEntitySetting
	 */
	@OneToMany(() => IntegrationEntitySetting, (it) => it.integration, {
		cascade: true
	})
	@JoinColumn()
	entitySettings?: IIntegrationEntitySetting[];

	/**
	 * IntegrationMap
	 */
	@OneToMany(() => IntegrationMap, (it) => it.integration, {
		cascade: true
	})
	@JoinColumn()
	entityMaps?: IIntegrationMap[];
}
