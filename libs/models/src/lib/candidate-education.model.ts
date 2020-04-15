import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
export interface Education extends IBaseEntityModel {
	schoolName?: string;
	degree?: string;
	completionDate?: Date;
	field?: string;
	notes?: string;
}
