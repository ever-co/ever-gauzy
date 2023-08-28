import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne, Index } from 'typeorm';
import { IIntegrationMap, IIntegrationTenant } from '@gauzy/contracts';
import { IsNotEmpty, IsUUID } from 'class-validator';
import {
	IntegrationTenant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('integration_map')
export class IntegrationMap extends TenantOrganizationBaseEntity implements IIntegrationMap {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@Column()
	entity: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@Column()
	sourceId: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@Column()
	gauzyId: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => IntegrationTenant })
	@ManyToOne(() => IntegrationTenant, (it) => it.entityMaps, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	integration: IIntegrationTenant;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: IntegrationMap) => it.integration)
	@Index()
	@Column()
	integrationId: IIntegrationTenant['id'];
}
