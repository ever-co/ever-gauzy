import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, OneToMany } from 'typeorm';
import { IIntegrationEntitySetting, IIntegrationTenant } from '@gauzy/models';
import { IntegrationEntitySetting } from '../integration-entity-setting/integration-entity-setting.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('integration_tenant')
export class IntegrationTenant
	extends TenantBase
	implements IIntegrationTenant {
	@ApiPropertyOptional({ type: IntegrationEntitySetting, isArray: true })
	@OneToMany(
		(type) => IntegrationEntitySetting,
		(setting) => setting.integration
	)
	@JoinColumn()
	entitySettings?: IntegrationEntitySetting[];

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	name: string;
}
