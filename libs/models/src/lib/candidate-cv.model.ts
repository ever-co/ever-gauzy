import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidateCv extends IBaseEntityModel {
	name: string;
	candidateId: string;
	cvId: string;
	cvUrl: string;
}

export interface ICandidateCvFindInput extends IBaseEntityModel {
	name?: string;
	candidateId?: string;
	cvId?: string;
	cvUrl?: string;
}

export interface ICandidateCvCreateInput {
	name: string;
	candidateId: string;
	cvId?: string;
	cvUrl: string;
}
