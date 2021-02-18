import { IBaseEntityModel } from './base-entity.model';

export interface IChangelog extends IBaseEntityModel {
	icon?: string;
	title?: string;
	date?: Date;
	content?: string;
	learnMoreUrl?: string;
}
