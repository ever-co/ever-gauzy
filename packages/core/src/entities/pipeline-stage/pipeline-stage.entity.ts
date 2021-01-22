import { DeepPartial, IPipelineStage as IStage } from '@gauzy/common';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Pipeline, TenantOrganizationBaseEntity } from '../internal';

@Entity('pipeline_stage')
export class PipelineStage
	extends TenantOrganizationBaseEntity
	implements IStage {
	constructor(input?: DeepPartial<PipelineStage>) {
		super(input);
	}

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
