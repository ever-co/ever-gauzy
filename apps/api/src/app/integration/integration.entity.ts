import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	Column,
	Entity,
	JoinColumn,
	RelationId,
	ManyToOne,
	OneToMany
} from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Base } from '../core/entities/base';
import { IIntegration } from '@gauzy/models';
import { IntegrationEntitySetting } from '../integration-entity-setting/integration-entity-setting.entity';

@Entity('integration')
export class Integration extends Base implements IIntegration {
	@ApiProperty({ type: Tenant })
	@ManyToOne((type) => Tenant, {
		nullable: false
	})
	@JoinColumn()
	tenant: Tenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((integration: Integration) => integration.tenant)
	readonly tenantId: string;

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
