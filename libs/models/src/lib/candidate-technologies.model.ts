import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidateTechnologies extends IBaseEntityModel {
	name: string;
}

export interface ICandidateTechnologiesFindInput extends IBaseEntityModel {
	name?: string;
}

export interface ICandidateTechnologiesVendorCreateInput {
	name: string;
}
