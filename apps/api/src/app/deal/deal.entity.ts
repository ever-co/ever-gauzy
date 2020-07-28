import { Deal as IDeal } from '@gauzy/models';
import { User } from '../user/user.entity';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { PipelineStage } from '../pipeline-stage/pipeline-stage.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('deal')
export class Deal extends TenantBase implements IDeal {
	@JoinColumn({ name: 'createdByUserId' })
	@ManyToOne(() => User)
	@ApiProperty({ type: User })
	public createdBy: User;

	@ManyToOne(() => PipelineStage, { onDelete: 'CASCADE' })
	@ApiProperty({ type: PipelineStage })
	@JoinColumn()
	public stage: PipelineStage;

	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public title: string;

	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public createdByUserId: string;

	@RelationId(({ stage }: Deal) => stage)
	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public stageId: string;
}
