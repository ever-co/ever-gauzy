import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, ManyToMany, JoinTable } from 'typeorm';
import { IIntegration, IIntegrationType, ITag } from '@gauzy/models';
import { IntegrationType } from './integration-type.entity';
import { IsNumber } from 'class-validator';
import { Tag } from '../tags/tag.entity';
import { Base } from '../core/entities/base';

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

	@ApiProperty({ type: Boolean, default: false })
	@Column({ default: false })
	isPaid?: boolean;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	version?: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	docUrl?: string;

	@ApiProperty({ type: Boolean, default: false })
	@Column({ default: false })
	isFreeTrial?: boolean;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0, type: 'numeric' })
	freeTrialPeriod?: number;

	@ManyToMany((type) => IntegrationType)
	@JoinTable({
		name: 'integration_integration_type'
	})
	integrationTypes?: IIntegrationType[];

	@ManyToMany(() => Tag)
	@JoinTable({
		name: 'tag_integration'
	})
	tags?: ITag[];
}
