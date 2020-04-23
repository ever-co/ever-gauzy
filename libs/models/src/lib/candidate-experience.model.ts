import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
export interface IExperience extends IBaseEntityModel {
	occupation: string;
	organization: string;
	duration: string;
	description?: string;
	candidateId?: string;
}
export interface IExperienceFindInput extends IBaseEntityModel {
	occupation?: string;
	organization?: string;
	duration?: string;
	description?: string;
	candidateId?: string;
}

export interface IExperienceCreateInput {
	occupation: string;
	organization: string;
	duration: string;
	description?: string;
	candidateId?: string;
}
