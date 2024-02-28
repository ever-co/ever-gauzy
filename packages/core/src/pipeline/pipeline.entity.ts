import { IPipeline, IPipelineStage } from '@gauzy/contracts';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	PipelineStage,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmPipelineRepository } from './repository/mikro-orm-pipeline.repository';
import { MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('pipeline', { mikroOrmRepository: () => MikroOrmPipelineRepository })
export class Pipeline extends TenantOrganizationBaseEntity implements IPipeline {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	public description: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	public name: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => PipelineStage })
	@MultiORMOneToMany(() => PipelineStage, (it) => it.pipeline, {
		cascade: ['insert']
	})
	public stages: IPipelineStage[];

	/*
	|--------------------------------------------------------------------------
	| EventSubscriber
	|--------------------------------------------------------------------------
	*/

	public __before_persist?(): void {
		const pipelineId = this.id ? { pipelineId: this.id } : {};
		let index = 0;

		this.stages?.forEach((stage) => {
			Object.assign(stage, pipelineId, { index: ++index });
		});
		console.log(this.stages);
	}
}
