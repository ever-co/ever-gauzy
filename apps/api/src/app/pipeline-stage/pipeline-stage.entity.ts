import { PipelineStage as IStage } from '@gauzy/models';
import { Base } from '../core/entities/base';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Pipeline } from '../pipeline/pipeline.entity';

@Entity('stage')
export class PipelineStage extends Base implements IStage {
	@ManyToOne(() => Pipeline, { onDelete: 'CASCADE' })
	@ApiProperty({ type: Pipeline })
	@JoinColumn()
	public pipeline: Pipeline;

	@RelationId(({ pipeline }: PipelineStage) => pipeline)
	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public pipelineId: string;

	@Column({ nullable: true, type: 'text' })
	@IsString()
	public description: string;

	@ApiProperty({ type: Number, minimum: 1 })
	@Column({ type: 'int' })
	@Min(1)
	@IsNotEmpty()
	@IsNumber()
	public index: number;

	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public name: string;
}
