import { JoinColumn, RelationId, JoinTable } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { IProposal, IEmployee, IOrganizationContact, ProposalStatusEnum, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	Employee,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	OrganizationContact,
	Tag,
	Taggable,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmProposalRepository } from './repository/mikro-orm-proposal.repository';

@MultiORMEntity('proposal', { mikroOrmRepository: () => MikroOrmProposalRepository })
export class Proposal extends TenantOrganizationBaseEntity implements IProposal, Taggable {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	jobPostUrl?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	valueDate?: Date;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn()
	jobPostContent?: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn()
	proposalContent?: string;

	@ApiProperty({ type: () => String, enum: ProposalStatusEnum })
	@IsEnum(ProposalStatusEnum)
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
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Proposal) => it.employee)
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;

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
	organizationContactId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Tags
	 */
	@MultiORMManyToMany(() => Tag, {
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
