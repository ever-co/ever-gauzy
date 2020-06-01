import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface IHelpCenter extends IBaseEntityModel {
	id?: string;
	name: string;
	description?: string;
	data?: string;
	children?: IHelpCenter[];
}
