import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ITenant extends IBaseEntityModel {
	name?: string;
}

export interface ITenantCreateInput {
	name: string;
}
