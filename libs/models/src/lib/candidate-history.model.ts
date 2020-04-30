import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ICandidateHistory extends IBaseEntityModel {
	candidateName: string;
	candidateId?: string;
	userName: string;
	action: string;
	subject: string;
}

export interface ICandidateHistoryFindInput extends IBaseEntityModel {
	candidateName?: string;
	candidateId?: string;
	userName?: number;
	action?: string;
	subject?: string;
}

export interface ICandidateHistoryCreateInput extends IBaseEntityModel {
	candidateName: string;
	candidateId?: string;
	userName: number;
	action: string;
	subject: string;
}
