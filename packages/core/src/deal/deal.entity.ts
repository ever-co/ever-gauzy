import {
	IDeal,
	IUser,
	IPipelineStage,
	IOrganizationContact
} from '@gauzy/contracts';
import {
	Column,
	JoinColumn,
	RelationId,
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
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmDealRepository } from './repository/mikro-orm-deal.repository';
import { MultiORMManyToOne, MultiORMOneToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('deal', { mikroOrmRepository: () => MikroOrmDealRepository })
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
	@MultiORMManyToOne(() => User)
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
	@MultiORMManyToOne(() => PipelineStage, { onDelete: 'CASCADE' })
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
	@MultiORMOneToOne(() => OrganizationContact, {
		onDelete: 'CASCADE',
		owner: true,
		joinColumn: 'clientId',
	})
	@JoinColumn()
	public client: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Deal) => it.client)
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	public clientId: string;
}
