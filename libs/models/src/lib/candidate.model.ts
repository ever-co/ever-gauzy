import { ICandidateFeedback } from './candidate-feedback.model';
import { ICandidateSource } from './candidate-source.model';
import { Organization, OrganizationFindInput } from './organization.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Location as ILocation } from './location.model';
import { UserFindInput, User } from './user.model';
import { OrganizationTeam } from './organization-team-model';
import {
	ITenant,
	OrganizationDepartment,
	OrganizationPositions,
	Tag
} from '@gauzy/models';
import { OrganizationEmploymentType } from './organization-employment-type.model';
import { IExperience } from './candidate-experience.model';
import { ISkill } from './candidate-skill.model';
import { IEducation } from './candidate-education.model';
import { ICandidateDocument } from './candidate-document.model';

export interface Candidate extends IBaseEntityModel, ILocation {
	user: User;
	userId: string;
	organization: Organization;
	orgId: string;
	status?: string;
	teams?: OrganizationTeam[];
	tenant: ITenant;
	organizationDepartments?: OrganizationDepartment[];
	organizationPosition?: OrganizationPositions;
	tags: Tag[];
	appliedDate?: Date;
	hiredDate?: Date;
	rejectDate?: Date;
	candidateLevel?: string;
	organizationEmploymentTypes?: OrganizationEmploymentType[];
	experience?: IExperience[];
	skills?: ISkill[];
	payPeriod?: string;
	billRateValue?: number;
	billRateCurrency?: string;
	reWeeklyLimit?: number;
	documents: ICandidateDocument[];
	educations?: IEducation[];
	source?: ICandidateSource;
	cvUrl?: string;
	feedbacks?: ICandidateFeedback[];
	rating?: number;
	isArchived?: boolean;
}

export enum CandidateStatus {
	APPLIED = 'APPLIED',
	REJECTED = 'HIRED',
	HIRED = 'REJECTED'
}

export interface CandidateFindInput extends IBaseEntityModel {
	organization?: OrganizationFindInput;
	user?: UserFindInput;
	valueDate?: Date;
	orgId?: string;
}

export interface CandidateUpdateInput {
	payPeriod?: string;
	billRateValue?: number;
	billRateCurrency?: string;
	reWeeklyLimit?: number;
	organizationDepartment?: OrganizationDepartment;
	organizationPosition?: OrganizationPositions;
	appliedDate?: Date;
	hiredDate?: Date;
	rejectDate?: Date;
	cvUrl?: string;
}

export interface CandidateCreateInput {
	user: User;
	organization: Organization;
	password?: string;
	appliedDate?: Date;
	hiredDate?: Date;
	rejectDate?: Date;
	cvUrl?: string;
	members?: Candidate[];
	tags?: Tag[];
	documents: ICandidateDocument[];
}
export interface CandidateLevel {
	id: string;
	level: string;
	organizationId: string;
}
export interface CandidateLevelInput {
	level: string;
	organizationId: string;
}
