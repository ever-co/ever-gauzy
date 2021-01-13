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
