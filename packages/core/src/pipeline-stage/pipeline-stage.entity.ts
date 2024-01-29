import { IPipeline, IPipelineStage as IStage } from '@gauzy/contracts';
import { Column, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
	Pipeline,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmPipelineStageRepository } from './repository/mikro-orm-pipeline-stage.repository';

@MultiORMEntity('pipeline_stage', { mikroOrmRepository: () => MikroOrmPipelineStageRepository })
export class PipelineStage extends TenantOrganizationBaseEntity implements IStage {

	@ApiProperty({ type: () => String })
	@Column({ nullable: true, type: 'text' })
	@IsString()
	public description: string;

	@ApiProperty({ type: () => Number, minimum: 1 })
	@Column({ type: 'int' })
	@Min(1)
	@IsNotEmpty()
	@IsNumber()
	public index: number;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public name: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Pipeline })
	@ManyToOne(() => Pipeline, { onDelete: 'CASCADE' })
	@ApiProperty({ type: () => Pipeline })
	@JoinColumn()
	public pipeline: IPipeline;

	@ApiProperty({ type: () => String })
	@RelationId((it: PipelineStage) => it.pipeline)
	@IsNotEmpty()
	@IsString()
	@Column()
	public pipelineId: string;
}
