import { Deal as IDeal } from '@gauzy/models';
import { User } from '../user/user.entity';
import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	RelationId,
	OneToOne
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	Min,
	Max,
	IsInt,
	IsOptional
} from 'class-validator';
import { PipelineStage } from '../pipeline-stage/pipeline-stage.entity';
import { TenantBase } from '../core/entities/tenant-base';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';

@Entity('deal')
export class Deal extends TenantBase implements IDeal {
	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public createdByUserId: string;

	@JoinColumn({ name: 'createdByUserId' })
	@ManyToOne(() => User)
	@ApiProperty({ type: User })
	public createdBy: User;

	@RelationId(({ stage }: Deal) => stage)
	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public stageId: string;

	@ManyToOne(() => PipelineStage, { onDelete: 'CASCADE' })
	@ApiProperty({ type: PipelineStage })
	@JoinColumn()
	public stage: PipelineStage;

	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public organizationId: string;

	@ApiProperty({ type: String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	public clientId: string;

	@OneToOne(() => OrganizationContact, { onDelete: 'CASCADE' })
	@ApiProperty({ type: OrganizationContact })
	@JoinColumn()
	public client: OrganizationContact;

	@ApiProperty({ type: String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public title: string;

	@ApiProperty({ type: Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(5)
	@Column()
	public probability?: number;
}
