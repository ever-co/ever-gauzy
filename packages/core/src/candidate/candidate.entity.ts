import {
	ICandidate,
	ICandidateInterview,
	ICandidateSource,
	PayPeriodEnum,
	ICandidateEducation,
	ICandidateExperience,
	ICandidateFeedback,
	ICandidateDocument,
	CandidateStatusEnum,
	ICandidateSkill,
	IOrganizationPosition,
	IOrganizationEmploymentType,
	IOrganizationDepartment,
	IContact,
	ITag,
	IUser,
	IEmployee
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	Column,
	Entity,
	JoinColumn,
	ManyToMany,
	ManyToOne,
	OneToOne,
	RelationId,
	OneToMany,
	Index,
	JoinTable
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
	Employee,
	OrganizationDepartment,
	OrganizationEmploymentType,
	OrganizationPosition,
	Tag,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from './../shared/pipes';

@Entity('candidate')
export class Candidate extends TenantOrganizationBaseEntity
	implements ICandidate {

	@ApiPropertyOptional({ type: () => Number })
	@Column({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	rating?: number;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	appliedDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	hiredDate?: Date;

	@ApiProperty({ type: () => String, enum: CandidateStatusEnum })
	@Column({ nullable: true, default: CandidateStatusEnum.APPLIED })
	status?: CandidateStatusEnum;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	rejectDate?: Date;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@Column({ length: 500, nullable: true })
	candidateLevel?: string;

	@ApiPropertyOptional({ type: () => Number })
	@Column({ nullable: true })
	reWeeklyLimit?: number; // Recurring Weekly Limit (hours)

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@Column({ length: 255, nullable: true })
	billRateCurrency?: string;

	@ApiPropertyOptional({ type: () => Number })
	@Column({ nullable: true })
	billRateValue?: number;

	@ApiProperty({ type: () => String, enum: PayPeriodEnum })
	@Column({ nullable: true })
	payPeriod?: PayPeriodEnum;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	cvUrl?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@Column({ nullable: true, default: false })
	isArchived?: boolean;

	ratings?: number;
	alreadyHired?: boolean;

	/*
    |--------------------------------------------------------------------------
    | @OneToOne
    |--------------------------------------------------------------------------
    */

	/**
	 * Contact
	 */
	@ApiProperty({ type: () => Contact })
	@OneToOne(() => Contact, (contact) => contact.candidate, {
		cascade: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	contact?: IContact;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Candidate) => it.contact)
	@Index()
	@Column({ nullable: true })
	readonly contactId?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => OrganizationPosition })
	@ManyToOne(() => OrganizationPosition, { nullable: true })
	@JoinColumn()
	organizationPosition?: IOrganizationPosition;

	@ApiProperty({ type: () => String })
	@RelationId((it: Candidate) => it.organizationPosition)
	@Index()
	@Column({ nullable: true })
	organizationPositionId?: IOrganizationPosition['id'];

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

	@ApiProperty({ type: () => String })
	@RelationId((it: Candidate) => it.source)
	@Index()
	@Column({ nullable: true })
	sourceId?: ICandidateSource['id'];

	/**
	 * User
	 */
	@ApiProperty({ type: () => User })
	@OneToOne(() => User, (user) => user.candidate, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
    user: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: Candidate) => it.user)
	@Index()
	@Column()
	userId: IUser['id'];

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@OneToOne(() => Employee, (employee) => employee.candidate)
	@JoinColumn()
    employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: Candidate) => it.employee)
	@Index()
	@Column({ nullable: true })
	employeeId?: IEmployee['id'];

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

	@ApiProperty({ type: () => Tag, isArray: true })
	@ManyToMany(() => Tag, (tag) => tag.candidates, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_candidate'
	})
	tags: ITag[];

	/**
	 * Organization Departments
	 */
	@ManyToMany(() => OrganizationDepartment, (department) => department.candidates, {
        onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
    })
    organizationDepartments?: IOrganizationDepartment[];

	/**
	 * Organization Employment Types
	 */
	@ManyToMany(() => OrganizationEmploymentType, (employmentType) => employmentType.candidates)
    organizationEmploymentTypes?: IOrganizationEmploymentType[];
}