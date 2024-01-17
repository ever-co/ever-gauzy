import { ApiProperty } from '@nestjs/swagger';
import { Column, JoinColumn, RelationId, ManyToOne, Index } from 'typeorm';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { Exclude, Expose } from 'class-transformer';
import { IIntegrationSetting } from '@gauzy/contracts';
import {
	IntegrationTenant,
	TenantOrganizationBaseEntity
} from './../core/entities/internal';
import { IsSecret } from './../core/decorators';
import { Entity } from '@gauzy/common';

@Entity('integration_setting')
export class IntegrationSetting extends TenantOrganizationBaseEntity implements IIntegrationSetting {

	@Exclude({ toPlainOnly: true })
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@Column()
	settingsName: string;

	@Exclude({ toPlainOnly: true })
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
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

	/**
	 * Additional fields to expose secret fields
	 */
	@Expose({ toPlainOnly: true, name: 'settingsName' })
	@IsSecret()
	wrapSecretKey?: string;

	@Expose({ toPlainOnly: true, name: 'settingsValue' })
	@IsSecret()
	wrapSecretValue?: string;
}
