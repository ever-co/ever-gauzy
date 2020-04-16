import { CandidateSource } from './../candidate_source/candidate_source.entity';
import { Candidate as ICandidate, Status } from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsOptional } from 'class-validator';
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
import { LocationBase } from '../core/entities/location-base';
import { OrganizationDepartment } from '../organization-department/organization-department.entity';
import { OrganizationEmploymentType } from '../organization-employment-type/organization-employment-type.entity';
import { OrganizationPositions } from '../organization-positions/organization-positions.entity';
import { Tag } from '../tags/tag.entity';
import { Tenant } from '../tenant/tenant.entity';
import { User } from '../user/user.entity';
import { Organization } from '../organization/organization.entity';
import { CandidateCv } from '../candidate-cv/candidate-cv.entity';
import { CandidateEducation } from '../candidate-education/candidate-education.entity';
// tslint:disable-next-line: nx-enforce-module-boundaries
import { Education } from 'libs/models/src/lib/candidate-education.model';

@Entity('candidate')
export class Candidate extends LocationBase implements ICandidate {
	@ManyToMany((type) => Tag)
	@JoinTable({
		name: 'tag_candidate'
	})
	tags: Tag[];

	@ManyToOne((type) => CandidateEducation)
	@JoinTable({
		name: 'candidate_education'
	})
	educations: Education[];

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

	@ApiProperty({ type: Tenant })
	@ManyToOne((type) => Tenant, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	tenant: Tenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((candidate: Candidate) => candidate.tenant)
	readonly tenantId?: string;

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

	@Column({ nullable: true })
	@ManyToOne((type) => CandidateSource, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	source?: string;

	@ApiProperty({ type: CandidateSource, readOnly: true })
	@RelationId((candidate: Candidate) => candidate.source)
	readonly sourceId?: CandidateSource;

	@ApiPropertyOptional({ type: Number })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	reWeeklyLimit?: number;

	@ApiPropertyOptional({ type: String, maxLength: 255 })
	@IsOptional()
	@Column({ length: 255, nullable: true })
	billRateCurrency?: string;

	@ApiPropertyOptional({ type: Number })
	@IsOptional()
	@Column({ nullable: true })
	billRateValue?: number;

	@ApiPropertyOptional({ type: String, maxLength: 255 })
	@IsOptional()
	@Column({ length: 255, nullable: true })
	payPeriod?: string;

	@ApiProperty({ type: CandidateCv })
	@OneToOne((type) => CandidateCv, {
		nullable: true,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	cv: CandidateCv;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((candidate: Candidate) => candidate.cv)
	readonly cvId: string;
}
