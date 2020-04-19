import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
export interface Experience extends IBaseEntityModel {
	occupation: string;
	organization: string;
	duration: string;
	description?: string;
}
