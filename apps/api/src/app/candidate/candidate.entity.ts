import { ICandidateSource } from './../../../../../libs/models/src/lib/candidate-source.model';
import { CandidateSkill } from './../candidate-skill/candidate-skill.entity';
import { CandidateExperience } from './../candidate-experience/candidate-experience.entity';
import {
	Candidate as ICandidate,
	Status,
	PayPeriodEnum,
	IEducation,
	IExperience,
	ISkill,
	ICandidateFeedback,
	ICandidateDocument
} from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsOptional, IsEnum } from 'class-validator';
import {
	Column,
	Entity,
	JoinColumn,
	JoinTable,
	ManyToMany,
	ManyToOne,
	OneToOne,
	RelationId
} from 'typeorm';
import { TenantLocationBase } from '../core/entities/tenant-location-base';
import { OrganizationDepartment } from '../organization-department/organization-department.entity';
import { OrganizationEmploymentType } from '../organization-employment-type/organization-employment-type.entity';
import { OrganizationPositions } from '../organization-positions/organization-positions.entity';
import { Tag } from '../tags/tag.entity';
import { User } from '../user/user.entity';
import { Organization } from '../organization/organization.entity';
import { CandidateEducation } from '../candidate-education/candidate-education.entity';
import { CandidateSource } from '../candidate-source/candidate-source.entity';
import { CandidateDocument } from '../candidate-documents/candidate-documents.entity';
import { CandidateFeedback } from '../candidate-feedbacks/candidate-feedbacks.entity';

@Entity('candidate')
export class Candidate extends TenantLocationBase implements ICandidate {
	@ManyToMany((type) => Tag)
	@JoinTable({
		name: 'tag_candidate'
	})
	tags: Tag[];

	@ManyToOne((type) => CandidateEducation)
	@JoinTable({
		name: 'candidate_education'
	})
	educations: IEducation[];

	@ManyToOne((type) => CandidateExperience)
	@JoinTable({
		name: 'candidate_experience'
	})
	experience: IExperience[];

	@ManyToOne((type) => CandidateSkill)
	@JoinTable({
		name: 'candidate_skills'
	})
	skills: ISkill[];

	@ApiProperty({ type: CandidateSource })
	@OneToOne((type) => CandidateSource, {
		nullable: true,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	source?: ICandidateSource;

	@ManyToOne((type) => CandidateDocument)
	@JoinTable({
		name: 'candidate_documents'
	})
	documents: ICandidateDocument[];

	@ManyToOne((type) => CandidateFeedback)
	@JoinTable({
		name: 'candidate_feedbacks'
	})
	feedbacks?: ICandidateFeedback[];

	@ApiProperty({ type: User })
	@OneToOne((type) => User, {
		nullable: false,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user: User;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((candidate: Candidate) => candidate.user)
	readonly userId: string;

	@ApiPropertyOptional({ type: Number })
	@IsOptional()
	@Column({ nullable: true, type: 'numeric' })
	rating?: number;

	@ApiProperty({ type: OrganizationPositions })
	@ManyToOne((type) => OrganizationPositions, { nullable: true })
	@JoinColumn()
	organizationPosition?: OrganizationPositions;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((candidate: Candidate) => candidate.organizationPosition)
	readonly organizationPositionId?: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String, readOnly: false })
	@RelationId((candidate: Candidate) => candidate.organization)
	orgId: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	appliedDate?: Date;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	hiredDate?: Date;

	@IsOptional()
	@Column({
		type: 'enum',
		enum: ['applied', 'rejected', 'hired'],
		default: 'applied'
	})
	status?: Status;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	rejectDate?: Date;

	@ManyToMany(
		(type) => OrganizationDepartment,
		(organizationDepartment) => organizationDepartment.members,
		{ cascade: true }
	)
	organizationDepartments?: OrganizationDepartment[];

	@ManyToMany(
		(type) => OrganizationEmploymentType,
		(organizationEmploymentType) => organizationEmploymentType.members,
		{ cascade: true }
	)
	organizationEmploymentTypes?: OrganizationEmploymentType[];

	@ApiPropertyOptional({ type: String, maxLength: 500 })
	@IsOptional()
	@Column({ length: 500, nullable: true })
	candidateLevel?: string;

	@ApiPropertyOptional({ type: Number })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	reWeeklyLimit?: number; //Recurring Weekly Limit (hours)

	@ApiPropertyOptional({ type: String, maxLength: 255 })
	@IsOptional()
	@Column({ length: 255, nullable: true })
	billRateCurrency?: string;

	@ApiPropertyOptional({ type: Number })
	@IsOptional()
	@Column({ nullable: true })
	billRateValue?: number;

	@ApiProperty({ type: String, enum: PayPeriodEnum })
	@IsEnum(PayPeriodEnum)
	@IsOptional()
	@Column({ nullable: true })
	payPeriod?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	cvUrl?: string;

	@ApiPropertyOptional({ type: Boolean, default: true })
	@Column({ nullable: true, default: true })
	isActive?: boolean;
}
