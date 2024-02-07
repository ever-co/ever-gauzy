import { IPipeline, IPipelineStage as IStage } from '@gauzy/contracts';
import { JoinColumn, RelationId } from 'typeorm';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
	Pipeline,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmPipelineStageRepository } from './repository/mikro-orm-pipeline-stage.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('pipeline_stage', { mikroOrmRepository: () => MikroOrmPipelineStageRepository })
export class PipelineStage extends TenantOrganizationBaseEntity implements IStage {

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true, type: 'text' })
	@IsString()
	public description: string;

	@ApiProperty({ type: () => Number, minimum: 1 })
	@MultiORMColumn({ type: 'int' })
	@Min(1)
	@IsNotEmpty()
	@IsNumber()
	public index: number;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	public name: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Pipeline })
	@MultiORMManyToOne(() => Pipeline, { onDelete: 'CASCADE' })
	@ApiProperty({ type: () => Pipeline })
	@JoinColumn()
	public pipeline: IPipeline;

	@ApiProperty({ type: () => String })
	@RelationId((it: PipelineStage) => it.pipeline)
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ relationId: true })
	public pipelineId: string;
}
