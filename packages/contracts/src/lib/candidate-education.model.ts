import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ICandidate } from './candidate.model';

export interface ICandidateEducation
	extends IBasePerTenantAndOrganizationEntityModel {
	schoolName: string;
	degree: string;
	completionDate: Date;
	field: string;
	notes?: string;
	candidateId?: string;
	candidate?: ICandidate;
}

export interface IEducationFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	schoolName?: string;
	degree?: string;
	completionDate?: Date;
	field?: string;
	notes?: string;
	candidateId?: string;
}

export interface IEducationCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	schoolName: string;
	degree: string;
	completionDate: Date;
	field: string;
	notes?: string;
	candidateId?: string;
}
