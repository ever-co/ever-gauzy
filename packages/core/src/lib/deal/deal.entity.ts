import { IDeal, IUser, IPipelineStage, IOrganizationContact, ID } from '@gauzy/contracts';
import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Min, Max, IsInt, IsOptional, IsUUID } from 'class-validator';
import { OrganizationContact, PipelineStage, TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToOne
} from './../core/decorators/entity';
import { MikroOrmDealRepository } from './repository/mikro-orm-deal.repository';

@MultiORMEntity('deal', { mikroOrmRepository: () => MikroOrmDealRepository })
export class Deal extends TenantOrganizationBaseEntity implements IDeal {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	title: string;

	@ApiProperty({ type: () => Number })
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
	@MultiORMManyToOne(() => User, {
		joinColumn: 'createdByUserId'
	})
	@JoinColumn({ name: 'createdByUserId' })
	createdBy: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@RelationId((it: Deal) => it.createdBy)
	@MultiORMColumn({ relationId: true })
	createdByUserId: ID;

	/**
	 * PipelineStage
	 */
	@MultiORMManyToOne(() => PipelineStage, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	stage: IPipelineStage;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@RelationId((it: Deal) => it.stage)
	@MultiORMColumn({ relationId: true })
	stageId: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationContact
	 */
	@MultiORMOneToOne(() => OrganizationContact, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE',

		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true
	})
	@JoinColumn()
	client?: IOrganizationContact;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Deal) => it.client)
	@MultiORMColumn({ nullable: true, relationId: true })
	clientId?: ID;
}
