import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';

export interface ITenant extends IBaseEntityModel {
	name?: string;
	organizations?: Organization[];
}

export interface ITenantCreateInput {
	name: string;
}
