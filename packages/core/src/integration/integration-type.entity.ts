import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, ManyToMany, Unique } from 'typeorm';
import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { IIntegration, IIntegrationType } from '@gauzy/contracts';
import { BaseEntity, Integration } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmIntegrationTypeRepository } from './repository/mikro-orm-integration-type.repository';

@MultiORMEntity('integration_type', { mikroOrmRepository: () => MikroOrmIntegrationTypeRepository })
@Unique(['name'])
export class IntegrationType extends BaseEntity implements IIntegrationType {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@Column()
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	description: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	icon: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@Column()
	groupName: string;

	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@Column()
	order: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ManyToMany(() => Integration, (it) => it.integrationTypes, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	integrations: IIntegration[];
}
