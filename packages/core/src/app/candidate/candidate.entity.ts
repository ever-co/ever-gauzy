import {
	ICandidate,
	ICandidateInterview,
	ICandidateSource,
	PayPeriodEnum,
	ICandidateEducation,
	ICandidateExperience,
	ICandidateFeedback,
	ICandidateDocument,
	CandidateStatus,
	ICandidateSkill,
	IOrganizationPosition,
	IOrganizationEmploymentType,
	IOrganizationDepartment,
	IContact,
	ITag
} from '@gauzy/contracts';
import { average, DeepPartial } from '@gauzy/common';
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
	RelationId,
	OneToMany,
	AfterLoad
} from 'typeorm';
import {
	CandidateDocument,
	CandidateEducation,
	CandidateExperience,
	CandidateFeedback,
	CandidateInterview,
	CandidateSkill,
	CandidateSource,
	Contact,
	OrganizationDepartment,
	OrganizationEmploymentType,
	OrganizationPositions,
	Tag,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';

@Entity('candidate')
export class Candidate
	extends TenantOrganizationBaseEntity
	implements ICandidate {
	constructor(input?: DeepPartial<Candidate>) {
		super(input);
	}

	@ManyToMany(() => Tag, (tag) => tag.candidate)
	@JoinTable({
		name: 'tag_candidate'
	})
	tags: ITag[];

	@ApiProperty({ type: Contact })
	@ManyToOne(() => Contact, (contact) => contact.candidates, {
		nullable: true,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	contact: IContact;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((candidate: Candidate) => candidate.contact)
	readonly contactId?: string;

	@OneToMany(() => CandidateEducation, (education) => education.candidate, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	educations: ICandidateEducation[];

	@OneToMany(() => CandidateInterview, (interview) => interview.candidate, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	interview?: ICandidateInterview[];

	@OneToMany(
		() => CandidateExperience,
		(experience) => experience.candidate,
		{
			onDelete: 'SET NULL'
		}
	)
	@JoinColumn()
	experience: ICandidateExperience[];

	@OneToMany(() => CandidateSkill, (skill) => skill.candidate, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	skills: ICandidateSkill[];

	@ApiProperty({ type: CandidateSource })
	@OneToOne(() => CandidateSource, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	source?: ICandidateSource;

	@OneToMany(() => CandidateDocument, (document) => document.candidate, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	documents?: ICandidateDocument[];

	@OneToMany(() => CandidateFeedback, (feedback) => feedback.candidate, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	feedbacks?: ICandidateFeedback[];

	@ApiProperty({ type: User })
	@OneToOne(() => User, {
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
	organizationPosition?: IOrganizationPosition;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((candidate: Candidate) => candidate.organizationPosition)
	readonly organizationPositionId?: string;

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

	@ApiProperty({ type: String, enum: CandidateStatus })
	@IsEnum(CandidateStatus)
	@IsOptional()
	@Column({ nullable: true, default: CandidateStatus.APPLIED })
	status?: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	rejectDate?: Date;

	@ManyToMany(
		() => OrganizationDepartment,
		(department) => department.candidates,
		{
			cascade: true
		}
	)
	@JoinTable({
		name: 'candidate_department'
	})
	organizationDepartments?: IOrganizationDepartment[];

	@ManyToMany(
		() => OrganizationEmploymentType,
		(employmentType) => employmentType.candidates,
		{
			cascade: true
		}
	)
	@JoinTable({
		name: 'candidate_employment_type'
	})
	organizationEmploymentTypes?: IOrganizationEmploymentType[];

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

	@ApiPropertyOptional({ type: Boolean, default: false })
	@Column({ nullable: true, default: false })
	isArchived?: boolean;

	ratings?: number;
	@AfterLoad()
	calculateRatings() {
		if (Array.isArray(this.feedbacks)) {
			this.ratings = average(this.feedbacks, 'rating');
		}
	}
}
