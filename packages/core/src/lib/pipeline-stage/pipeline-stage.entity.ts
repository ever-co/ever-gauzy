import { IPipeline, IPipelineStage as IStage } from '@gauzy/contracts';
import { JoinColumn, RelationId } from 'typeorm';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	Pipeline,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmPipelineStageRepository } from './repository/mikro-orm-pipeline-stage.repository';

@MultiORMEntity('pipeline_stage', { mikroOrmRepository: () => MikroOrmPipelineStageRepository })
export class PipelineStage extends TenantOrganizationBaseEntity implements IStage {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	public description: string;

	@ApiProperty({ type: () => Number, minimum: 1 })
	@IsNotEmpty()
	@Min(1)
	@MultiORMColumn({ type: 'int' })
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

	/**
	 * Pipeline
	 */
	@MultiORMManyToOne(() => Pipeline, (it) => it.stages, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	public pipeline: IPipeline;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@RelationId((it: PipelineStage) => it.pipeline)
	@MultiORMColumn({ relationId: true })
	public pipelineId: IPipeline['id'];
}
