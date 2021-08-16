import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, ManyToMany, JoinTable } from 'typeorm';
import { IIntegration, IIntegrationType, ITag } from '@gauzy/contracts';
import { IsNumber } from 'class-validator';
import { BaseEntity, IntegrationType, Tag } from '../core/entities/internal';

@Entity('integration')
export class Integration extends BaseEntity implements IIntegration {
	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	name: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	imgSrc: string;

	@ApiProperty({ type: () => Boolean, default: false })
	@Column({ default: false })
	isComingSoon?: boolean;

	@ApiProperty({ type: () => Boolean, default: false })
	@Column({ default: false })
	isPaid?: boolean;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	version?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	docUrl?: string;

	@ApiProperty({ type: () => Boolean, default: false })
	@Column({ default: false })
	isFreeTrial?: boolean;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0, type: 'numeric' })
	freeTrialPeriod?: number;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	order?: number;

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => IntegrationType, isArray: true })
	@ManyToMany(() => IntegrationType, (integrationType) => integrationType.integrations)
	@JoinTable({
		name: 'integration_integration_type'
	})
	integrationTypes?: IIntegrationType[];

	@ApiProperty({ type: () => Tag, isArray: true })
	@ManyToMany(() => Tag)
	@JoinTable({
		name: 'tag_integration'
	})
	tags?: ITag[];
}
