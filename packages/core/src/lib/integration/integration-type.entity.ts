import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unique } from 'typeorm';
import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { IIntegration, IIntegrationType } from '@gauzy/contracts';
import { BaseEntity, Integration } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToMany } from './../core/decorators/entity';
import { MikroOrmIntegrationTypeRepository } from './repository/mikro-orm-integration-type.repository';

@MultiORMEntity('integration_type', { mikroOrmRepository: () => MikroOrmIntegrationTypeRepository })
@Unique(['name'])
export class IntegrationType extends BaseEntity implements IIntegrationType {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn()
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	description: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	icon: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn()
	groupName: string;

	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn()
	order: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@MultiORMManyToMany(() => Integration, (it) => it.integrationTypes, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	integrations: IIntegration[];
}
