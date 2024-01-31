import { ApiProperty } from '@nestjs/swagger';
import { Column, JoinColumn, RelationId, ManyToOne, Index } from 'typeorm';
import { IIntegrationMap, IIntegrationTenant, IntegrationEntity } from '@gauzy/contracts';
import { IsNotEmpty, IsUUID } from 'class-validator';
import {
	IntegrationTenant,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmIntegrationMapRepository } from './repository/mikro-orm-integration-map.repository';

@MultiORMEntity('integration_map', { mikroOrmRepository: () => MikroOrmIntegrationMapRepository })
export class IntegrationMap extends TenantOrganizationBaseEntity implements IIntegrationMap {

	@ApiProperty({ type: () => String, enum: IntegrationEntity })
	@IsNotEmpty()
	@Column()
	entity: IntegrationEntity;

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
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
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
