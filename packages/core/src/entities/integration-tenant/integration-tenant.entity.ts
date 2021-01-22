import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, OneToMany } from 'typeorm';
import { DeepPartial, IIntegrationTenant } from '@gauzy/common';
import {
	IntegrationEntitySetting,
	TenantOrganizationBaseEntity
} from '../internal';

@Entity('integration_tenant')
export class IntegrationTenant
	extends TenantOrganizationBaseEntity
	implements IIntegrationTenant {
	constructor(input?: DeepPartial<IntegrationTenant>) {
		super(input);
	}

	@ApiPropertyOptional({ type: IntegrationEntitySetting, isArray: true })
	@OneToMany(() => IntegrationEntitySetting, (setting) => setting.integration)
	@JoinColumn()
	entitySettings?: IntegrationEntitySetting[];

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	name: string;
}
