import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, ManyToMany, JoinTable, ManyToOne } from 'typeorm';
import { IIntegration } from '@gauzy/models';
import { IntegrationType } from './integration-type.entity';
import { TenantBase } from '../core/entities/tenant-base';
import { Organization } from '../organization/organization.entity';

@Entity('integration')
export class Integration extends TenantBase implements IIntegration {
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

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization: Organization;
}
