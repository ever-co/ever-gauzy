import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateEducation
	extends IBasePerTenantAndOrganizationEntityModel {
	schoolName: string;
	degree: string;
	completionDate: Date;
	field: string;
	notes?: string;
	candidateId?: string;
}

export interface IEducationFindInput {
	schoolName?: string;
	degree?: string;
	completionDate?: Date;
	field?: string;
	notes?: string;
	candidateId?: string;
}

export interface IEducationCreateInput {
	schoolName: string;
	degree: string;
	completionDate: Date;
	field: string;
	notes?: string;
	candidateId?: string;
}
