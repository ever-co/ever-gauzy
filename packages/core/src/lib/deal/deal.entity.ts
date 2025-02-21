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
	/**
	 * The title of the deal.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	title: string;

	/**
	 * The probability of the deal.
	 */
	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(0)
	@Max(5)
	@MultiORMColumn()
	probability: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The pipeline stage associated with this deal.
	 */
	@MultiORMManyToOne(() => PipelineStage, {
		onDelete: 'CASCADE' // Database cascade action on delete.
	})
	@JoinColumn()
	stage: IPipelineStage;

	/**
	 * The ID for the associated pipeline stage.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@RelationId((it: Deal) => it.stage)
	@MultiORMColumn({ relationId: true })
	stageId: ID;

	/**
	 * The user who created the deal.
	 */
	@MultiORMManyToOne(() => User)
	@JoinColumn()
	createdByUser: IUser;

	/**
	 * The ID for the user who created the deal.
	 */
	@RelationId((deal: Deal) => deal.createdByUser)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	createdByUserId: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The associated client (OrganizationContact) for the deal.
	 */
	@MultiORMOneToOne(() => OrganizationContact, {
		nullable: true, // Indicates if relation column value can be nullable or not.
		onDelete: 'CASCADE', // Database cascade action on delete.
		owner: true // This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.
	})
	@JoinColumn()
	client?: IOrganizationContact;

	/**
	 * The ID of the associated client (OrganizationContact) for the deal.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Deal) => it.client)
	@MultiORMColumn({ nullable: true, relationId: true })
	clientId?: ID;
}
