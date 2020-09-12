import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, ManyToMany, JoinTable, ManyToOne } from 'typeorm';
import { IIntegration } from '@gauzy/models';
import { IntegrationType } from './integration-type.entity';
import { TenantBase } from '../core/entities/tenant-base';
import { Organization } from '../organization/organization.entity';
import { IsNumber } from 'class-validator';
import { Tag } from '../tags/tag.entity';

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

	@ApiProperty({ type: Boolean, default: false })
	@Column({ default: false })
	isPaid?: boolean;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	version: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	docUrl: string;

	@ApiProperty({ type: Boolean, default: false })
	@Column({ default: false })
	isFreeTrial: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0, type: 'numeric' })
	freeTrialPeriod: number;

	@ManyToMany((type) => IntegrationType)
	@JoinTable({
		name: 'integration_integration_type'
	})
	integrationTypes?: IntegrationType[];

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization: Organization;

	@ManyToMany(() => Tag)
	@JoinTable({
		name: 'integrations_tags'
	})
	tags?: Tag[];
}
