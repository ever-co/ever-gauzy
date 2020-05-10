import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, ManyToMany, JoinTable } from 'typeorm';
import { Base } from '../core/entities/base';
import { IIntegration } from '@gauzy/models';
import { IntegrationType } from './integration-type.entity';

@Entity('integration')
export class Integration extends Base implements IIntegration {
	@ApiProperty({ type: String })
	@Column({ nullable: false })
	name: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	imgSrc: string;

	@ApiProperty({ type: Boolean, default: false })
	@Column({ default: false })
	isComingSoon?: boolean;

	@ManyToMany((type) => IntegrationType)
	@JoinTable({
		name: 'integration_integration_type'
	})
	integrationTypes?: IntegrationType[];
}
