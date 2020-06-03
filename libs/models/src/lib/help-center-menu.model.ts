import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface IHelpCenter extends IBaseEntityModel {
	name: string;
	icon: string;
	flag: string;
	privacy: string;
	description?: string;
	data?: string;
	children?: IHelpCenter[];
}
