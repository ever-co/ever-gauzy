import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
export interface Education extends IBaseEntityModel {
	schoolName: string;
	degree: string;
	completionDate: Date;
	field: string;
	notes?: string;
	candidateId?: string;
}
export interface IEducationFindInput extends IBaseEntityModel {
	schoolName?: string;
	degree?: string;
	completionDate?: Date;
	field?: string;
	notes?: string;
	candidateId?: string;
}

export interface IEducationCreateInput {
	schoolName: string;
	degree: string;
	completionDate: Date;
	field: string;
	notes?: string;
	candidateId?: string;
}
