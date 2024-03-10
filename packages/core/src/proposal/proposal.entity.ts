import {
	Index,
	JoinColumn,
	RelationId,
	JoinTable
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IProposal,
	IEmployee,
	ITag,
	IOrganizationContact,
	ProposalStatusEnum
} from '@gauzy/contracts';
import {
	Employee,
	OrganizationContact,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmProposalRepository } from './repository/mikro-orm-proposal.repository';
import { MultiORMManyToMany, MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('proposal', { mikroOrmRepository: () => MikroOrmProposalRepository })
export class Proposal extends TenantOrganizationBaseEntity
	implements IProposal {

	@ApiProperty({ type: () => String })
	@Index()
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

	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Proposal) => it.employee)
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: string;

	@ApiPropertyOptional({ type: () => OrganizationContact })
	@MultiORMManyToOne(() => OrganizationContact, (organizationContact) => organizationContact.proposals, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Proposal) => it.organizationContact)
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationContactId?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	// Tags
	@ApiProperty({ type: () => Tag })
	@MultiORMManyToMany(() => Tag, (tag) => tag.proposals, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_proposal',
		joinColumn: 'proposalId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		name: 'tag_proposal'
	})
	tags?: ITag[];
}
