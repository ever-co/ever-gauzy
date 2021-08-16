import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne, Index } from 'typeorm';
import { IIntegrationMap, IIntegrationTenant } from '@gauzy/contracts';
import {
	IntegrationTenant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { IsString } from 'class-validator';

@Entity('integration_map')
export class IntegrationMap
	extends TenantOrganizationBaseEntity
	implements IIntegrationMap {
	
	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	entity: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	sourceId: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	gauzyId: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	@ApiProperty({ type: () => IntegrationTenant })
	@ManyToOne(() => IntegrationTenant, {
		nullable: false
	})
	@JoinColumn()
	integration: IIntegrationTenant;

	@ApiProperty({ type: () => String, readOnly: true })
	@Column()
	@RelationId((it: IntegrationMap) => it.integration)
	@IsString()
	@Index()
	@Column()
	readonly integrationId: string;
}
