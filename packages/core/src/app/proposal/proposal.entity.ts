import {
	Column,
	Entity,
	Index,
	JoinColumn,
	RelationId,
	ManyToOne,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDate } from 'class-validator';
import {
	IProposal,
	IEmployee,
	ITag,
	IOrganizationContact
} from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import {
	Employee,
	OrganizationContact,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('proposal')
export class Proposal
	extends TenantOrganizationBaseEntity
	implements IProposal {
	constructor(input?: DeepPartial<Proposal>) {
		super(input);
	}

	@ApiProperty({ type: Tag })
	@ManyToMany(() => Tag, (tag) => tag.proposal)
	@JoinTable({ name: 'tag_proposal' })
	tags: ITag[];

	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee: IEmployee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((proposal: Proposal) => proposal.employee)
	@IsString()
	@Column({ nullable: true })
	readonly employeeId?: string;

	@ApiProperty({ type: String })
	@Index()
	@IsString()
	@Column({ nullable: true })
	jobPostUrl: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column()
	jobPostContent?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column()
	proposalContent?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column()
	status?: string;

	@ApiPropertyOptional({ type: OrganizationContact })
	@ManyToOne(
		(type) => OrganizationContact,
		(organizationContact) => organizationContact.proposals,
		{
			nullable: true,
			onDelete: 'CASCADE'
		}
	)
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiProperty({ type: String })
	@RelationId((contact: Proposal) => contact.organizationContact)
	@Column({ nullable: true })
	organizationContactId?: string;
}
