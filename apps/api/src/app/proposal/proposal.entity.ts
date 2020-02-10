import {
	Column,
	Entity,
	Index,
	JoinColumn,
	RelationId,
	ManyToOne
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsDate } from 'class-validator';
import { Base } from '../core/entities/base';
import { Proposal as IProposal } from '@gauzy/models';
import { Employee } from '../employee';
import { Organization } from '../organization';

@Entity('proposal')
export class Proposal extends Base implements IProposal {
	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((proposal: Proposal) => proposal.employee)
	@IsString()
	@Column({ nullable: true })
	readonly employeeId?: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((proposal: Proposal) => proposal.organization)
	@IsString()
	@Column({ nullable: true })
	readonly organizationId?: string;

	@ApiProperty({ type: String })
	@Index()
	@IsString()
	@IsNotEmpty()
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
}
