import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IPipeline, IPipelineStage } from '@gauzy/contracts';
import { PipelineStage, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmPipelineRepository } from './repository/mikro-orm-pipeline.repository';

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
	@MultiORMOneToMany(() => PipelineStage, (it) => it.pipeline, {
		cascade: ['insert']
	})
	public stages: IPipelineStage[];

	/*
	|--------------------------------------------------------------------------
	| EventSubscriber
	|--------------------------------------------------------------------------
	*/
	/**
	 * 	@BeforeInsert
	 */
	public __before_persist?(): void {
		const pipelineId = this.id ? { pipelineId: this.id } : {};
		let index = 0;

		if (this.stages) {
			this.stages.forEach((stage) => {
				Object.assign(stage, pipelineId, { index: ++index });
			});
		}
	}
}
