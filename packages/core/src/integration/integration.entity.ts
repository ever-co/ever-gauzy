import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, ManyToMany, JoinTable, Unique } from 'typeorm';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { IIntegration, IIntegrationType, ITag } from '@gauzy/contracts';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { BaseEntity, Tag } from '../core/entities/internal';
import { IntegrationType } from './integration-type.entity';

@Entity('integration')
@Unique(['name'])
export class Integration extends BaseEntity implements IIntegration {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@Column() // Define a unique constraint on the "name" column
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true }) // Define a unique constraint on the "provider" column (E.g github, jira, hubstaff)
	provider: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	redirectUrl: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	imgSrc: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Column({ default: false })
	isComingSoon: boolean;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Column({ default: false })
	isPaid: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	version: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	docUrl: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Column({ default: false })
	isFreeTrial: boolean;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Column({
		nullable: true,
		default: 0,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	freeTrialPeriod: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Column({ nullable: true })
	order: number;

	fullImgUrl?: string;
	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 *
	 */
	@ManyToMany(() => IntegrationType, (it) => it.integrations, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'integration_integration_type'
	})
	integrationTypes?: IIntegrationType[];

	/**
	 *
	 */
	@ManyToMany(() => Tag, (tag) => tag.integrations, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_integration'
	})
	tags?: ITag[];
}
