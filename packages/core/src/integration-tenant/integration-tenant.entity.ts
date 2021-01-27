import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, OneToMany } from 'typeorm';
import { IIntegrationTenant } from '@gauzy/contracts';
import {
	IntegrationEntitySetting,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('integration_tenant')
export class IntegrationTenant
	extends TenantOrganizationBaseEntity
	implements IIntegrationTenant {
	@ApiPropertyOptional({ type: IntegrationEntitySetting, isArray: true })
	@OneToMany(() => IntegrationEntitySetting, (setting) => setting.integration)
	@JoinColumn()
	entitySettings?: IntegrationEntitySetting[];

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	name: string;
}
