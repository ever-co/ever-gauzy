import { ICandidateInterview } from './candidate-interview.model';
import { ICandidateFeedback } from './candidate-feedback.model';
import { ICandidateSource } from './candidate-source.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IUserFindInput, IUser } from './user.model';
import { IOrganizationTeam } from './organization-team.model';
import { IOrganizationEmploymentType } from './organization-employment-type.model';
import { ICandidateExperience } from './candidate-experience.model';
import { ICandidateSkill } from './candidate-skill.model';
import { ICandidateEducation } from './candidate-education.model';
import { ICandidateDocument } from './candidate-document.model';
import { IOrganizationDepartment } from './organization-department.model';
import { IOrganizationPosition } from './organization-positions.model';
import { IContact } from './contact.model';
import { ITag } from './tag.model';
import { IEmployee, PayPeriodEnum } from './employee.model';

export interface IRelationalCandidate {
	candidate?: ICandidate;
	candidateId?: ICandidate['id'];
}

export interface ICandidate extends IBasePerTenantAndOrganizationEntityModel {
	user: IUser;
	userId: IUser['id'];
	status?: CandidateStatusEnum;
	teams?: IOrganizationTeam[];
	organizationDepartments?: IOrganizationDepartment[];
	organizationPosition?: IOrganizationPosition;
	organizationPositionId?: string;
	tags: ITag[];
	appliedDate?: Date;
	hiredDate?: Date;
	rejectDate?: Date;
	candidateLevel?: string;
	organizationEmploymentTypes?: IOrganizationEmploymentType[];
	experience?: ICandidateExperience[];
	skills?: ICandidateSkill[];
	payPeriod?: PayPeriodEnum;
	billRateValue?: number;
	billRateCurrency?: string;
	reWeeklyLimit?: number;
	minimumBillingRate?: number;
	documents?: ICandidateDocument[];
	educations?: ICandidateEducation[];
	source?: ICandidateSource;
	cvUrl?: string;
	feedbacks?: ICandidateFeedback[];
	rating?: number;
	interview?: ICandidateInterview[];
	contact?: IContact;
	contactId?: IContact['id'];
	employee?: IEmployee;
	employeeId?: IEmployee['id'];
	ratings?: number;
	alreadyHired?: boolean;
}

export enum CandidateStatusEnum {
	APPLIED = 'APPLIED',
	REJECTED = 'REJECTED',
	HIRED = 'HIRED'
}

export interface ICandidateFindInput extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
	user?: IUserFindInput;
	status?: CandidateStatusEnum;
}

export interface ICandidateUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	id?: ICandidate['id'];
	payPeriod?: PayPeriodEnum;
	billRateValue?: number;
	billRateCurrency?: string;
	reWeeklyLimit?: number;
	organizationDepartments?: IOrganizationDepartment[];
	organizationPosition?: IOrganizationPosition;
	organizationEmploymentTypes?: IOrganizationEmploymentType[];
	tags?: ITag[];
	contact?: IContact;
	appliedDate?: Date;
	hiredDate?: Date;
	rejectDate?: Date;
	cvUrl?: string;
	candidateLevel?: string;
	minimumBillingRate?: number;
}

export interface ICandidateCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	user: IUser;
	password?: string;
	appliedDate?: Date;
	hiredDate?: Date;
	source?: ICandidateSource;
	rejectDate?: Date;
	cvUrl?: string;
	members?: ICandidate[];
	tags?: ITag[];
	documents: ICandidateDocument[];
}
export interface ICandidateLevel extends IBasePerTenantAndOrganizationEntityModel {
	id: string;
	level: string;
}
export interface ICandidateLevelInput extends IBasePerTenantAndOrganizationEntityModel {
	level: string;
}

export interface ICandidateViewModel extends IBasePerTenantAndOrganizationEntityModel {
	fullName: string;
	email: string;
	id: string;
	imageUrl: string;
	source?: ICandidateSource;
	rating?: number;
	isArchived?: boolean;
	status?: CandidateStatusEnum;
}
