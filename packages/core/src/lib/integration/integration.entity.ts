import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinTable, Unique } from 'typeorm';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { IIntegration, IIntegrationType, ITag } from '@gauzy/contracts';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { BaseEntity, Tag } from '../core/entities/internal';
import { IntegrationType } from './integration-type.entity';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToMany, VirtualMultiOrmColumn } from './../core/decorators/entity';
import { MikroOrmIntegrationRepository } from './repository/mikro-orm-integration.repository';

@MultiORMEntity('integration', { mikroOrmRepository: () => MikroOrmIntegrationRepository })
@Unique(['name'])
export class Integration extends BaseEntity implements IIntegration {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn() // Define a unique constraint on the "name" column
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true }) // Define a unique constraint on the "provider" column (E.g github, jira, hubstaff)
	provider: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	redirectUrl: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	imgSrc: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isComingSoon: boolean;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isPaid: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	version: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	docUrl: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isFreeTrial: boolean;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		nullable: true,
		default: 0,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	freeTrialPeriod: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	order: number;

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	fullImgUrl?: string;
	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 *
	 */
	@MultiORMManyToMany(() => IntegrationType, (it) => it.integrations, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'integration_integration_type',
		joinColumn: 'integrationId',
		inverseJoinColumn: 'integrationTypeId'
	})
	@JoinTable({
		name: 'integration_integration_type'
	})
	integrationTypes?: IIntegrationType[];

	/**
	 *
	 */
	@MultiORMManyToMany(() => Tag, (tag) => tag.integrations, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_integration',
		joinColumn: 'integrationId',
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({
		name: 'tag_integration'
	})
	tags?: ITag[];
}
