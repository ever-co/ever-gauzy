import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface ICandidatePersonalQualities extends IBaseEntityModel {
	name: string;
	interviewId?: string;
	rating?: number;
}

export interface ICandidatePersonalQualitiesFindInput extends IBaseEntityModel {
	name?: string;
	interviewId?: string;
	rating?: number;
}

export interface ICandidatePersonalQualitiesCreateInput {
	name: string;
	interviewId?: string;
	rating?: number;
}
