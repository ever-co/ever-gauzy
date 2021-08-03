import {
	Column,
	Entity,
	Index,
	JoinColumn,
	RelationId,
	ManyToOne,
	ManyToMany
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDate } from 'class-validator';
import {
	IProposal,
	IEmployee,
	ITag,
	IOrganizationContact
} from '@gauzy/contracts';
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

	@ApiProperty({ type: () => String })
	@Index()
	@IsString()
	@Column({ nullable: true })
	jobPostUrl: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column()
	jobPostContent?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column()
	proposalContent?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column()
	status?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Proposal) => it.employee)
	@IsString()
	@Column({ nullable: true })
	readonly employeeId?: string;

	@ApiPropertyOptional({ type: () => OrganizationContact })
	@ManyToOne(() => OrganizationContact, (organizationContact) => organizationContact.proposals, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Proposal) => it.organizationContact)
	@IsString()
	@Column({ nullable: true })
	organizationContactId?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	// Tags
	@ApiProperty({ type: () => Tag })
	@ManyToMany(() => Tag, (tag) => tag.proposal)
	tags?: ITag[];
}
