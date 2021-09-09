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
	ITag,
	IUser
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsOptional, IsEnum, IsString } from 'class-validator';
import {
	Column,
	Entity,
	JoinColumn,
	ManyToMany,
	ManyToOne,
	OneToOne,
	RelationId,
	OneToMany,
	Index
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
	OrganizationPosition,
	Tag,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';

@Entity('candidate')
export class Candidate
	extends TenantOrganizationBaseEntity
	implements ICandidate {
	
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@Column({ nullable: true, type: 'numeric' })
	rating?: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	appliedDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	hiredDate?: Date;

	@ApiProperty({ type: () => String, enum: CandidateStatus })
	@IsEnum(CandidateStatus)
	@IsOptional()
	@Column({ nullable: true, default: CandidateStatus.APPLIED })
	status?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	rejectDate?: Date;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@IsOptional()
	@Column({ length: 500, nullable: true })
	candidateLevel?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	reWeeklyLimit?: number; //Recurring Weekly Limit (hours)

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@Column({ length: 255, nullable: true })
	billRateCurrency?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@Column({ nullable: true })
	billRateValue?: number;

	@ApiProperty({ type: () => String, enum: PayPeriodEnum })
	@IsEnum(PayPeriodEnum)
	@IsOptional()
	@Column({ nullable: true })
	payPeriod?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	cvUrl?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@Column({ nullable: true, default: false })
	isArchived?: boolean;

	ratings?: number;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	@ApiProperty({ type: () => Contact })
	@ManyToOne(() => Contact, (contact) => contact.candidates, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	contact: IContact;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Candidate) => it.contact)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	readonly contactId?: string;

	@ApiProperty({ type: () => OrganizationPosition })
	@ManyToOne(() => OrganizationPosition, { nullable: true })
	@JoinColumn()
	organizationPosition?: IOrganizationPosition;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Candidate) => it.organizationPosition)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	readonly organizationPositionId?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToOne 
    |--------------------------------------------------------------------------
    */

	@ApiProperty({ type: () => CandidateSource })
	@OneToOne(() => CandidateSource, {
		nullable: true,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	source?: ICandidateSource;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Candidate) => it.source)
	@IsString()
	@Index()
	@Column({ nullable: true })
	readonly sourceId?: string;

	@ApiProperty({ type: () => User })
	@OneToOne(() => User, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
    user: IUser;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Candidate) => it.user)
	@IsString()
	@Index()
	@Column()
	readonly userId: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */
	@OneToMany(() => CandidateEducation, (education) => education.candidate, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	educations?: ICandidateEducation[];

	@OneToMany(() => CandidateInterview, (interview) => interview.candidate, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	interview?: ICandidateInterview[];

	@OneToMany(() => CandidateExperience, (experience) => experience.candidate, { 
		onDelete: 'SET NULL' 
	})
	@JoinColumn()
	experience?: ICandidateExperience[];

	@OneToMany(() => CandidateSkill, (skill) => skill.candidate, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	skills?: ICandidateSkill[];

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

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	@ManyToMany(() => Tag, (tag) => tag.candidate)
	tags: ITag[];

	@ManyToMany(() => OrganizationDepartment, (department) => department.candidates)
    organizationDepartments?: IOrganizationDepartment[];

	@ManyToMany(() => OrganizationEmploymentType, (employmentType) => employmentType.candidates)
    organizationEmploymentTypes?: IOrganizationEmploymentType[];
}