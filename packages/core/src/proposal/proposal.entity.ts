import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	JoinColumn,
	RelationId,
	JoinTable
} from 'typeorm';
import { IsOptional, IsUUID } from 'class-validator';
import {
	IProposal,
	IEmployee,
	IOrganizationContact,
	ProposalStatusEnum
} from '@gauzy/contracts';
import {
	Employee,
	OrganizationContact,
	Tag,
	TenantOrganizationBaseEntity
} from '@core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMManyToOne } from '@core/decorators';
import { MikroOrmProposalRepository } from './repository/mikro-orm-proposal.repository';
import { Taggable } from '../tags/tag.types';

@MultiORMEntity('proposal', { mikroOrmRepository: () => MikroOrmProposalRepository })
export class Proposal extends TenantOrganizationBaseEntity implements IProposal, Taggable {

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	jobPostUrl: string;

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn()
	jobPostContent?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn()
	proposalContent?: string;

	@ApiProperty({ type: () => String, enum: ProposalStatusEnum })
	@MultiORMColumn()
	status?: ProposalStatusEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 *
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Proposal) => it.employee)
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: string;

	/**
	 *
	 */
	@MultiORMManyToOne(() => OrganizationContact, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Proposal) => it.organizationContact)
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationContactId?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Tags
	 */
	@MultiORMManyToMany(() => Tag, (it: Tag) => it.proposals, {
		/**  Database cascade action on update. */
		onUpdate: 'CASCADE',
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true,
		/** Pivot table for many-to-many relationship. */
		pivotTable: 'tag_proposal',
		/** Column in pivot table referencing 'proposal' primary key. */
		joinColumn: 'proposalId',
		/** Column in pivot table referencing 'tag' primary key. */
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({ name: 'tag_proposal' })
	tags?: Tag[];
}
