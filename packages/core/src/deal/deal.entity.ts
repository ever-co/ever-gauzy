import {
	IDeal,
	IUser,
	IPipelineStage,
	IOrganizationContact
} from '@gauzy/contracts';
import {
	JoinColumn,
	RelationId
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
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToOne } from './../core/decorators/entity';
import { MikroOrmDealRepository } from './repository/mikro-orm-deal.repository';

@MultiORMEntity('deal', { mikroOrmRepository: () => MikroOrmDealRepository })
export class Deal extends TenantOrganizationBaseEntity implements IDeal {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	title: string;

	@ApiProperty({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(5)
	@MultiORMColumn()
	probability?: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * User
	 */
	@ApiProperty({ type: () => User })
	@MultiORMManyToOne(() => User, {
		joinColumn: 'createdByUserId',
	})
	@JoinColumn({ name: 'createdByUserId' })
	createdBy: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: Deal) => it.createdBy)
	@IsString()
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	createdByUserId: string;

	/**
	 * PipelineStage
	 */
	@ApiProperty({ type: () => PipelineStage })
	@MultiORMManyToOne(() => PipelineStage, { onDelete: 'CASCADE' })
	@JoinColumn()
	stage: IPipelineStage;

	@ApiProperty({ type: () => String })
	@RelationId((it: Deal) => it.stage)
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	stageId: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationContact
	 */
	@MultiORMOneToOne(() => OrganizationContact, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',

		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true
	})
	@JoinColumn()
	client: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Deal) => it.client)
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, relationId: true })
	clientId: string;
}
