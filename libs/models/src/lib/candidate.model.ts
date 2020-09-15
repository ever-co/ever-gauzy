import { ICandidateInterview } from './candidate-interview.model';
import { ICandidateFeedback } from './candidate-feedback.model';
import { ICandidateSource } from './candidate-source.model';
import { IOrganization, IOrganizationFindInput } from './organization.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IUserFindInput, IUser } from './user.model';
import { IOrganizationTeam } from './organization-team-model';
import {
	IOrganizationDepartment,
	IOrganizationPositions,
	ITag,
	IContact
} from '@gauzy/models';
import { IOrganizationEmploymentType } from './organization-employment-type.model';
import { ICandidateExperience } from './candidate-experience.model';
import { ICandidateSkill } from './candidate-skill.model';
import { ICandidateEducation } from './candidate-education.model';
import { ICandidateDocument } from './candidate-document.model';

export interface ICandidate extends IBasePerTenantAndOrganizationEntityModel {
	user: IUser;
	userId: string;
	status?: string;
	teams?: IOrganizationTeam[];
	organizationDepartments?: IOrganizationDepartment[];
	organizationPosition?: IOrganizationPositions;
	tags: ITag[];
	appliedDate?: Date;
	hiredDate?: Date;
	rejectDate?: Date;
	candidateLevel?: string;
	organizationEmploymentTypes?: IOrganizationEmploymentType[];
	experience?: ICandidateExperience[];
	skills?: ICandidateSkill[];
	payPeriod?: string;
	billRateValue?: number;
	billRateCurrency?: string;
	reWeeklyLimit?: number;
	documents?: ICandidateDocument[];
	educations?: ICandidateEducation[];
	source?: ICandidateSource;
	cvUrl?: string;
	feedbacks?: ICandidateFeedback[];
	rating?: number;
	isArchived?: boolean;
	interview?: ICandidateInterview[];
	contact: IContact;
}

export enum CandidateStatus {
	APPLIED = 'APPLIED',
	REJECTED = 'REJECTED',
	HIRED = 'HIRED'
}

export interface ICandidateFindInput {
	organization?: IOrganizationFindInput;
	user?: IUserFindInput;
	valueDate?: Date;
	organizationId?: string;
}

export interface ICandidateUpdateInput {
	payPeriod?: string;
	billRateValue?: number;
	billRateCurrency?: string;
	reWeeklyLimit?: number;
	organizationDepartment?: IOrganizationDepartment;
	organizationPosition?: IOrganizationPositions;
	appliedDate?: Date;
	hiredDate?: Date;
	rejectDate?: Date;
	cvUrl?: string;
}

export interface ICandidateCreateInput {
	user: IUser;
	organization: IOrganization;
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
export interface ICandidateLevel {
	id: string;
	level: string;
	organizationId: string;
}
export interface ICandidateLevelInput {
	level: string;
	organizationId: string;
}
