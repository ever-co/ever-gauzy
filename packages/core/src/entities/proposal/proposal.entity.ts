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
} from '@gauzy/common';
import { Employee } from '../employee/employee.entity';
import { Tag } from '../tags/tag.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';

@Entity('proposal')
export class Proposal extends TenantOrganizationBase implements IProposal {
	@ApiProperty({ type: Tag })
	@ManyToMany((type) => Tag, (tag) => tag.proposal)
	@JoinTable({ name: 'tag_proposal' })
	tags: ITag[];

	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: true, onDelete: 'CASCADE' })
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
