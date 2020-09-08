import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';
export interface IExperience extends IBaseEntityModel {
	occupation: string;
	organization?: Organization;
	tenant: ITenant;
	duration: string;
	description?: string;
	candidateId?: string;
}
export interface IExperienceFindInput extends IBaseEntityModel {
	occupation?: string;
	organization?: string;
  tenant?: string;
	duration?: string;
	description?: string;
	candidateId?: string;
}

export interface IExperienceCreateInput {
	occupation: string;
  organization: Organization;
	duration: string;
	description?: string;
	candidateId?: string;
}
