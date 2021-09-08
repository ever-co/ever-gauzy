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
	OneToOne,
	Index
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
	public title: string;

	@ApiProperty({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(5)
	@Column()
	public probability?: number;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	
	/**
	 * User
	 */
	@ApiProperty({ type: () => User })
	@ManyToOne(() => User)
	@JoinColumn({ name: 'createdByUserId' })
	public createdBy: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: Deal) => it.createdBy)
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	public createdByUserId: string;

	/**
	 * PipelineStage
	 */
	@ApiProperty({ type: () => PipelineStage })
	@ManyToOne(() => PipelineStage, { onDelete: 'CASCADE' })
	@JoinColumn()
	public stage: IPipelineStage;

	@ApiProperty({ type: () => String })
	@RelationId((it: Deal) => it.stage)
	@IsNotEmpty()
	@IsString()
	@Index()
	@Column()
	public stageId: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * OrganizationContact
	 */
  	@ApiProperty({ type: () => OrganizationContact })
	@OneToOne(() => OrganizationContact, { onDelete: 'CASCADE' })
	@JoinColumn()
	public client: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Deal) => it.client)
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	public clientId: string;
}
