import { IRelationalCandidate } from './candidate.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateSource extends ICandidateSourceCreateInput{}

export interface ICandidateSourceFindInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalCandidate {
	name?: string;
}

export interface ICandidateSourceCreateInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalCandidate {
	name: string;
}

export interface ICandidateSourceUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
}
