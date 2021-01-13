import { IPipelineStage as IStage } from '@gauzy/common';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Pipeline } from '../pipeline/pipeline.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('pipeline_stage')
export class PipelineStage extends TenantOrganizationBase implements IStage {
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
