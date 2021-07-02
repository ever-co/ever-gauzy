import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, ManyToMany } from 'typeorm';
import { IIntegration, IIntegrationType } from '@gauzy/contracts';
import { BaseEntity, Integration } from '../core/entities/internal';

@Entity('integration_type')
export class IntegrationType extends BaseEntity implements IIntegrationType {
	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	name: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	groupName: string;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: false })
	order: number;

	@ManyToMany(() => Integration, (integration) => integration.integrationTypes)
	integrations?: IIntegration[];
}
