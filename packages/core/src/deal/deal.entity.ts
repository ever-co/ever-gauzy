import {
	IDeal,
	IUser,
	IPipelineStage,
	IOrganizationContact
} from '@gauzy/contracts';
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
import {
	OrganizationContact,
	PipelineStage,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';

@Entity('deal')
export class Deal extends TenantOrganizationBaseEntity implements IDeal {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public createdByUserId: string;

	@JoinColumn({ name: 'createdByUserId' })
	@ManyToOne(() => User)
	@ApiProperty({ type: () => User })
	public createdBy: IUser;

	@RelationId(({ stage }: Deal) => stage)
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public stageId: string;

	@ManyToOne(() => PipelineStage, { onDelete: 'CASCADE' })
	@ApiProperty({ type: () => PipelineStage })
	@JoinColumn()
	public stage: IPipelineStage;

	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	public clientId: string;

	@OneToOne(() => OrganizationContact, { onDelete: 'CASCADE' })
	@ApiProperty({ type: () => OrganizationContact })
	@JoinColumn()
	public client: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Column()
	public title: string;

	@ApiProperty({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(5)
	@Column()
	public probability?: number;
}
