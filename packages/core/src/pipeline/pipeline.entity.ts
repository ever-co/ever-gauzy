import { IPipeline, IPipelineStage } from '@gauzy/contracts';
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
import {
	PipelineStage,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('pipeline')
export class Pipeline
	extends TenantOrganizationBaseEntity
	implements IPipeline {
	
	@ApiProperty({ type: () => PipelineStage })
	@OneToMany(() => PipelineStage, ({ pipeline }) => pipeline, {
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

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column()
	public isActive: boolean;

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
