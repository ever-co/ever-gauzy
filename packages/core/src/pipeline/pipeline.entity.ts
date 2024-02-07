import { IPipeline, IPipelineStage } from '@gauzy/contracts';
import {
	AfterInsert,
	AfterLoad,
	AfterUpdate,
	BeforeInsert,
	Column
} from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
	PipelineStage,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmPipelineRepository } from './repository/mikro-orm-pipeline.repository';
import { MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('pipeline', { mikroOrmRepository: () => MikroOrmPipelineRepository })
export class Pipeline extends TenantOrganizationBaseEntity implements IPipeline {

	@ApiProperty({ type: () => PipelineStage })
	@MultiORMOneToMany(() => PipelineStage, ({ pipeline }) => pipeline, {
		cascade: ['insert']
	})
	public stages: IPipelineStage[];

	@Column({ nullable: true, type: 'text' })
	@ApiProperty({ type: () => String })
	@IsString()
	public description: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public name: string;


	@BeforeInsert()
	public __before_persist?(): void {
		const pipelineId = this.id ? { pipelineId: this.id } : {};
		let index = 0;

		this.stages?.forEach((stage) => {
			Object.assign(stage, pipelineId, { index: ++index });
		});
	}

	@AfterLoad()
	@AfterInsert()
	@AfterUpdate()
	public __after_fetch?(): void {
		if (this.stages) {
			this.stages.sort(({ index: a }, { index: b }) => a - b);
		}
	}
}
