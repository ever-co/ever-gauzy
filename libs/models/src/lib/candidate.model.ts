import { User, Tag, OrganizationDepartment, OrganizationPositions } from '..';
import { Organization, OrganizationFindInput } from './organization.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Location as ILocation } from './location.model';
import { UserFindInput } from './user.model';
import { OrganizationTeams } from './organization-teams-model';
import { ITenant } from '@gauzy/models';
import { OrganizationEmploymentType } from './organization-employment-type.model';
import { Education } from './candidate-education.model';
import { Experience } from './candidate-experience.model';

export interface Candidate extends IBaseEntityModel, ILocation {
	user: User;
	userId: string;
	organization: Organization;
	orgId: string;
	status?: Status;
	teams?: OrganizationTeams[];
	tenant: ITenant;
	organizationDepartments?: OrganizationDepartment[];
	organizationPosition?: OrganizationPositions;
	tags: Tag[];
	appliedDate?: Date;
	hiredDate?: Date;
	rejectDate?: Date;
	candidateLevel?: string;
	organizationEmploymentTypes?: OrganizationEmploymentType[];
	experience?: Experience[];
	skills?: string[];
	payPeriod?: string;
	billRateValue?: number;
	billRateCurrency?: string;
	reWeeklyLimit?: number;
	educations?: Education[];
	source?: string;
}

export type Status = 'applied' | 'rejected' | 'hired';

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
	skiills?: string[];
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
