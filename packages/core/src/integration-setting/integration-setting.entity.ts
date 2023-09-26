import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne, Index } from 'typeorm';
import { IsUUID } from 'class-validator';
import { IIntegrationSetting } from '@gauzy/contracts';
import {
	IntegrationTenant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('integration_setting')
export class IntegrationSetting extends TenantOrganizationBaseEntity implements IIntegrationSetting {

	@ApiProperty({ type: () => String })
	@Column()
	settingsName: string;

	@ApiProperty({ type: () => String })
	@Column()
	settingsValue: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * IntegrationTenant
	 */
	@ApiProperty({ type: () => IntegrationTenant })
	@ManyToOne(() => IntegrationTenant, (it) => it.settings, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	integration?: IntegrationTenant;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: IntegrationSetting) => it.integration)
	@Index()
	@Column()
	integrationId?: IntegrationTenant['id'];
}
