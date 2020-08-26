import { PipelineStage as IStage } from '@gauzy/models';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Pipeline } from '../pipeline/pipeline.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('stage')
export class PipelineStage extends TenantBase implements IStage {
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

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((pipelineStage: PipelineStage) => pipelineStage.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
