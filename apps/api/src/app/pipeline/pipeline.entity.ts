import { IPipeline } from '@gauzy/models';
import {
	AfterInsert,
	AfterLoad,
	AfterUpdate,
	BeforeInsert,
	Column,
	Entity,
	OneToMany
} from 'typeorm';
import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PipelineStage } from '../pipeline-stage/pipeline-stage.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('pipeline')
export class Pipeline extends TenantOrganizationBase implements IPipeline {
	@OneToMany(() => PipelineStage, ({ pipeline }) => pipeline, {
		cascade: ['insert']
	})
	@ApiProperty({ type: PipelineStage })
	public stages: PipelineStage[];

	@Column({ nullable: true, type: 'text' })
	@ApiProperty({ type: String })
	@IsString()
	public description: string;

	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public name: string;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column()
	public isActive: boolean;

	@BeforeInsert()
	public __before_persist(): void {
		const pipelineId = this.id ? { pipelineId: this.id } : {};
		let index = 0;

		this.stages?.forEach((stage) => {
			Object.assign(stage, pipelineId, { index: ++index });
		});
	}

	@AfterLoad()
	@AfterInsert()
	@AfterUpdate()
	public __after_fetch(): void {
		if (this.stages) {
			this.stages.sort(({ index: a }, { index: b }) => a - b);
		}
	}
}
