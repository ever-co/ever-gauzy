import {
	Column,
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
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmProposalRepository } from './repository/mikro-orm-proposal.repository';
import { MultiORMManyToMany, MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('proposal', { mikroOrmRepository: () => MikroOrmProposalRepository })
export class Proposal extends TenantOrganizationBaseEntity
	implements IProposal {

	@ApiProperty({ type: () => String })
	@Index()
	@Column({ nullable: true })
	jobPostUrl: string;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: () => String })
	@Column()
	jobPostContent?: string;

	@ApiPropertyOptional({ type: () => String })
	@Column()
	proposalContent?: string;

	@ApiProperty({ type: () => String, enum: ProposalStatusEnum })
	@Column()
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
	@Column({ nullable: true })
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
	@Column({ nullable: true })
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
		pivotTable: 'tag_proposal'
	})
	@JoinTable({
		name: 'tag_proposal'
	})
	tags?: ITag[];
}
